"""Crash test: kill the production server mid-job and check the jobs survive a restart.

Runner: own-server. `python3 tests/run.py tests/core_recovery.py` calls this file as
`core_recovery.py <app-root> <data-dir> <port>` and starts no server of its own.
A folder named `logs` must exist next to <data-dir>.
"""
import http.cookiejar
import json
import os
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request

APP, DATA, PORT = sys.argv[1], sys.argv[2], sys.argv[3]
BASE = f"http://127.0.0.1:{PORT}"
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
results = []


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    try:
        with opener.open(req, timeout=30) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read() or b"{}")


def boot(log):
    env = dict(os.environ, TREG_MODE="mock", MOCK_DELAY_MS="6000", PARALLAX_DATA_DIR=DATA)
    proc = subprocess.Popen(
        ["node", "node_modules/next/dist/bin/next", "start", "-p", PORT],
        cwd=APP, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
    )
    return proc


def crash(proc):
    os.killpg(proc.pid, signal.SIGKILL)
    proc.wait()


def wait_port(up=True):
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/", timeout=2).read()
            if up:
                return True
        except urllib.error.HTTPError:
            if up:
                return True
        except Exception:
            if not up:
                return True
        time.sleep(0.25)
    return False


def rows(ids):
    db = sqlite3.connect(f"file:{DATA}/parallax.db?mode=ro", uri=True, timeout=5)
    try:
        marks = ",".join("?" * len(ids))
        got = {r[0]: r[1:] for r in db.execute(f"SELECT id, status, treg_call_id, attempts, error_code FROM jobs WHERE id IN ({marks})", ids)}
    finally:
        db.close()
    return [got[i] for i in ids]


shutil.rmtree(DATA, ignore_errors=True)
os.makedirs(DATA)
log = open(os.path.join(os.path.dirname(DATA), "logs", "recovery.log"), "w")

first = boot(log)
check("server up", wait_port())
_, g = call("POST", "/api/auth/guest")
_, t = call("POST", "/api/wallet/topup", {"packId": "pack-500"})
start = t["balance"]

ids, costs = [], []
# The third goes straight to Google, the one provider whose calls cannot be replayed.
for model in ("seedance-1-lite", "veo-3.1-lite", "nano-banana-2"):
    s, out = call("POST", "/api/jobs", {"modelId": model, "prompt": f"crash test {model}"})
    if s != 200:
        check(f"submit {model}", False, f"{s} {out}")
        crash(first)
        sys.exit(1)
    ids.append(out["jobs"][0]["id"])
    costs.append(out["jobs"][0]["cost"])
time.sleep(1.0)
before = rows(ids)
check("all three running before the crash", all(r[0] == "running" for r in before), str(before))

crash(first)
check("server is down", wait_port(up=False))

# Make two of them look like the crash hit in the middle of the provider call.
db = sqlite3.connect(os.path.join(DATA, "parallax.db"), timeout=5)
db.execute("UPDATE jobs SET treg_call_id = NULL WHERE id IN (?, ?)", (ids[1], ids[2]))
db.commit()
db.close()

second = boot(log)
# No HTTP requests from here: only the startup hook can wake the worker.
deadline = time.time() + 40
state = rows(ids)
while time.time() < deadline:
    try:
        state = rows(ids)
    except sqlite3.Error:
        pass
    if all(r[0] in ("succeeded", "failed") for r in state):
        break
    time.sleep(0.5)

a, b, c = state
check("job with a provider call id: finished after restart", a[0] == "succeeded", str(a))
check("interrupted job, safe to replay: ran again and finished", b[0] == "succeeded" and b[2] == 2, str(b))
check("interrupted job, not safe to replay: failed cleanly", c[0] == "failed" and c[3] == "interrupted", str(c))

check("server answers after restart", wait_port())
_, me = call("GET", "/api/auth/me")
expected = start - costs[0] - costs[1]
check("credits: two charged, one returned", me.get("balance") == expected, f"balance={me.get('balance')} expected={expected} costs={costs}")
_, j = call("GET", f"/api/jobs/{ids[2]}")
check("member sees a plain message", j["job"]["error"]["message"] == "This one was interrupted. Try again.", str(j["job"]["error"]))
_, lib = call("GET", "/api/assets?kind=video")
check("two videos in the library", len(lib.get("assets", [])) == 2, f"{len(lib.get('assets', []))}")

crash(second)
log.close()
print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
