"""End-to-end check of the Parallax API in mock mode. Usage: e2e.py <base-url>"""
import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = sys.argv[1].rstrip("/")
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
results = []


def call(method, path, body=None, headers=None, raw=False):
    data = None
    h = dict(headers or {})
    if body is not None and not isinstance(body, bytes):
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    elif body is not None:
        data = body
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with opener.open(req, timeout=60) as res:
            payload = res.read()
            status, hdrs = res.status, res.headers
    except urllib.error.HTTPError as err:
        payload, status, hdrs = err.read(), err.code, err.headers
    if raw:
        return status, hdrs, payload
    try:
        return status, json.loads(payload or b"{}")
    except ValueError:
        return status, {"_text": payload[:200].decode("utf8", "replace")}


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def wait_ready():
    for _ in range(90):
        try:
            status, _ = call("GET", "/api/auth/me")
            if status == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def wait_jobs(ids, seconds=60):
    deadline = time.time() + seconds
    jobs = {}
    while time.time() < deadline:
        for i in ids:
            _, out = call("GET", f"/api/jobs/{i}")
            jobs[i] = out.get("job", {})
        if all(j.get("status") in ("succeeded", "failed", "canceled") for j in jobs.values()):
            break
        time.sleep(0.5)
    return [jobs[i] for i in ids]


def multipart(field, filename, content, extra=None):
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in (extra or {}).items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), {"Content-Type": f"multipart/form-data; boundary={boundary}"}


check("server ready", wait_ready())

s, me = call("GET", "/api/auth/me")
check("signed out: me is null", s == 200 and me.get("user") is None, str(me)[:80])
s, out = call("GET", "/api/jobs")
check("signed out: jobs is 401", s == 401 and out.get("error", {}).get("code") == "unauthorized", f"{s}")
s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "x"}, headers={"Origin": "https://evil.example"})
check("cross-site write refused", s == 403, f"{s}")

s, g = call("POST", "/api/auth/guest")
check("guest account", s == 200 and g["user"]["isGuest"] and g["balance"] == 60000, f"{s} balance={g.get('balance')}")
start = g["balance"]

# --- image, 2 results -------------------------------------------------------
s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a lighthouse at dusk", "count": 2, "values": {"aspect": "16:9"}})
jobs = out.get("jobs", [])
check("image: queued", s == 200 and len(jobs) >= 1 and all(j["status"] == "queued" for j in jobs), f"{s} jobs={len(jobs)} {str(out)[:160] if s != 200 else ''}")
held = sum(j["cost"] for j in jobs)
check("image: credits held", out.get("balance") == start - held and held > 0, f"held={held} balance={out.get('balance')}")
done = wait_jobs([j["id"] for j in jobs])
assets = [a for j in done for a in j.get("assets", [])]
check("image: succeeded", all(j["status"] == "succeeded" for j in done), str([(j.get("status"), j.get("error")) for j in done]))
check("image: 2 results", len(assets) == 2, f"{len(assets)} assets; {[(a['kind'], a['mime'], a.get('width'), a.get('height')) for a in assets]}")
if assets:
    s, hdrs, payload = call("GET", assets[0]["url"], raw=True)
    check("image: file serves", s == 200 and payload[:4] == b"\x89PNG" and hdrs.get("X-Content-Type-Options") == "nosniff", f"{s} {len(payload)} bytes {hdrs.get('Content-Type')}")
    s, hdrs, payload = call("GET", assets[0]["url"], headers={"Range": "bytes=0-99"}, raw=True)
    check("image: range request", s == 206 and len(payload) == 100, f"{s} {len(payload)}")
s, me = call("GET", "/api/auth/me")
check("image: charged exactly the hold", me["balance"] == start - held, f"balance={me['balance']}")
after_image = me["balance"]

# --- failure gives credits back ---------------------------------------------
s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "this should [fail]"})
done = wait_jobs([j["id"] for j in out.get("jobs", [])])
check("failure: job failed with a message", bool(done) and all(j["status"] == "failed" and j["error"]["message"] for j in done), str([j.get("error") for j in done])[:160])
s, me = call("GET", "/api/auth/me")
check("failure: credits returned", me["balance"] == after_image, f"balance={me['balance']}")

# --- video ------------------------------------------------------------------
s, out = call("POST", "/api/jobs", {"modelId": "seedance-1-lite", "prompt": "waves rolling in", "values": {"aspect": "9:16"}})
vjobs = out.get("jobs", [])
check("video: queued", s == 200 and len(vjobs) == 1, f"{s} {str(out)[:200] if s != 200 else ''}")
done = wait_jobs([j["id"] for j in vjobs], 90)
vassets = [a for j in done for a in j.get("assets", [])]
check("video: succeeded", bool(done) and all(j["status"] == "succeeded" for j in done) and len(vassets) == 1, str([(j.get("status"), j.get("error")) for j in done]))
if vassets:
    a = vassets[0]
    check("video: probed", a["kind"] == "video" and a.get("width") and a.get("duration"), f"{a.get('mime')} {a.get('width')}x{a.get('height')} {a.get('duration')}s poster={bool(a.get('posterUrl'))}")
    if a.get("posterUrl"):
        s, hdrs, payload = call("GET", a["posterUrl"], raw=True)
        check("video: poster serves", s == 200 and payload[:2] == b"\xff\xd8", f"{s} {len(payload)} bytes")

# --- speech -----------------------------------------------------------------
s, out = call("POST", "/api/jobs", {"modelId": "minimax-speech-2.8-turbo", "prompt": "Hello from Parallax. This is a test of speech."})
done = wait_jobs([j["id"] for j in out.get("jobs", [])])
aassets = [a for j in done for a in j.get("assets", [])]
check("speech: succeeded", s == 200 and bool(done) and all(j["status"] == "succeeded" for j in done) and len(aassets) == 1, f"{s} {str(out)[:200] if s != 200 else [(j.get('status'), j.get('error')) for j in done]}")
if aassets:
    check("speech: is audio", aassets[0]["kind"] == "audio" and aassets[0].get("duration"), f"{aassets[0].get('mime')} {aassets[0].get('duration')}s")

# --- upload + reference image -------------------------------------------------
if assets:
    _, _, png = call("GET", assets[0]["url"], raw=True)
    body, h = multipart("file", "ref.png", png, {"accept": "image"})
    s, up = call("POST", "/api/assets", body, headers=h)
    check("upload: stored", s == 200 and up.get("asset", {}).get("source") == "upload", f"{s} {str(up)[:160]}")
    body, h = multipart("file", "evil.html", b"<html><script>alert(1)</script></html>")
    s, bad = call("POST", "/api/assets", body, headers=h)
    check("upload: html refused", s == 400, f"{s} {bad.get('error', {}).get('message', '')[:80]}")
    if s == 200 or up.get("asset"):
        ref = up["asset"]["id"]
        s, out = call("POST", "/api/jobs", {"modelId": "nano-banana-2", "prompt": "make it snow", "inputs": {"refs": [ref]}})
        done = wait_jobs([j["id"] for j in out.get("jobs", [])])
        check("reference image: succeeded", s == 200 and bool(done) and done[0]["status"] == "succeeded" and done[0]["inputs"].get("refs") == [ref], f"{s} {str(out)[:200] if s != 200 else done[0].get('error')}")
        s, out = call("POST", "/api/jobs", {"modelId": "nano-banana-2", "prompt": "x", "inputs": {"refs": ["ast_0000000000000000"]}})
        check("reference image: unknown file refused", s == 404, f"{s}")
        if vassets:
            s, out = call("POST", "/api/jobs", {"modelId": "nano-banana-2", "prompt": "x", "inputs": {"refs": [vassets[0]["id"]]}})
            check("reference image: video refused", s == 400, f"{s} {out.get('error', {}).get('message', '')[:90]}")

# --- validation ---------------------------------------------------------------
s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": ""})
check("validation: empty prompt", s == 400, f"{s} {out.get('error', {}).get('message')}")
s, out = call("POST", "/api/jobs", {"modelId": "nope", "prompt": "x"})
check("validation: unknown model", s == 400, f"{s}")
s, out = call("POST", "/api/jobs", {"modelId": "sora-2-pro", "prompt": "x"})
check("validation: offline model", s == 409 and out["error"]["code"] == "model_unavailable", f"{s} {out.get('error', {}).get('message', '')[:80]}")
s, out = call("POST", "/api/jobs", {"modelId": "hailuo-2.3-fast", "prompt": "x"})
check("validation: missing required image", s == 400, f"{s} {out.get('error', {}).get('message')}")
s, out = call("POST", "/api/jobs", {"modelId": "veo-3.1", "prompt": "x", "count": 4, "values": {"duration": 8}})
check("validation: not enough credits", s == 402 and out["error"]["code"] == "insufficient_credits", f"{s} {out.get('error', {}).get('message')}")

# --- concurrency limit and cancel -----------------------------------------------
s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "one", "count": 4})
first = out.get("jobs", [])
s2, out2 = call("POST", "/api/jobs", {"modelId": "nano-banana-2-lite", "prompt": "two", "count": 4})
second = out2.get("jobs", [])
# A free plan runs 4 at once. The first request is one native batch job, so 4 more is one too many.
check("limit: too many at once", s == 200 and len(first) == 1 and s2 == 429 and out2.get("error", {}).get("code") == "too_many_jobs", f"first={s}/{len(first)} second={s2} {out2.get('error', {}).get('message', '')[:80]}")
s3, out3 = call("POST", "/api/jobs", {"modelId": "nano-banana-2-lite", "prompt": "three", "count": 3})
third = out3.get("jobs", [])
check("limit: fills the last slots", s3 == 200 and len(third) == 3, f"third={s3}/{len(third)}")
wait_jobs([j["id"] for j in first + second + third], 90)

s, before = call("GET", "/api/auth/me")
s, out = call("POST", "/api/jobs", {"modelId": "seedance-1-lite", "prompt": "to cancel"})
cj = out.get("jobs", [{}])[0]
s, d = call("DELETE", f"/api/jobs/{cj.get('id')}")
s2, me = call("GET", "/api/auth/me")
check("cancel: queued job canceled, credits back", (s == 200 and me["balance"] == before["balance"]) or s == 409, f"delete={s} balance {before['balance']} -> {me['balance']}")
if s == 409:
    wait_jobs([cj["id"]], 90)

# --- lists, library, wallet -------------------------------------------------------
s, out = call("GET", "/api/jobs?limit=5")
check("list: jobs newest first", s == 200 and len(out["jobs"]) == 5 and out["jobs"][0]["cursor"] > out["jobs"][-1]["cursor"], f"{s}")
s, page2 = call("GET", f"/api/jobs?limit=5&before={out['jobs'][-1]['cursor']}")
check("list: second page", s == 200 and page2["jobs"] and page2["jobs"][0]["cursor"] < out["jobs"][-1]["cursor"], f"{s}")
s, out = call("GET", "/api/jobs?status=active")
check("list: nothing active at the end", s == 200 and len(out["jobs"]) == 0, f"{len(out.get('jobs', []))} active")
s, lib = call("GET", "/api/assets?kind=image&limit=100")
check("library: images listed", s == 200 and len(lib["assets"]) >= 3, f"{len(lib.get('assets', []))} images")
if assets:
    aid = assets[0]["id"]
    s, p = call("PATCH", f"/api/assets/{aid}", {"favorite": True, "title": "Lighthouse"})
    check("library: rename and favourite", s == 200 and p["asset"]["favorite"] is True and p["asset"]["title"] == "Lighthouse", f"{s} {str(p)[:120]}")
    s, fav = call("GET", "/api/assets?favorite=1")
    check("library: favourites filter", s == 200 and [a["id"] for a in fav["assets"]] == [aid], f"{len(fav.get('assets', []))}")
    s, d = call("DELETE", f"/api/assets/{aid}")
    s2, _, _ = call("GET", assets[0]["url"], raw=True)
    check("library: delete removes the file", s == 200 and s2 == 404, f"delete={s} file={s2}")
s, w = call("GET", "/api/wallet")
check("wallet: history", s == 200 and w["balance"] == me["balance"] and len(w["history"]) > 3, f"{s} balance={w.get('balance')} rows={len(w.get('history', []))} kinds={sorted(set(r['kind'] for r in w.get('history', [])))}")
s, t = call("POST", "/api/wallet/topup", {"packId": "pack-100"})
check("wallet: demo top-up", s == 200 and t["balance"] == w["balance"] + 100000, f"{s} {t.get('balance')}")

# --- another member cannot see this one's things -----------------------------------
other = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
mine, opener = opener, other
call("POST", "/api/auth/guest")
if len(assets) > 1:
    s, _, _ = call("GET", assets[1]["url"], raw=True)
    check("privacy: other member cannot fetch a file", s == 404, f"{s}")
    s, out = call("POST", "/api/jobs", {"modelId": "nano-banana-2", "prompt": "x", "inputs": {"refs": [assets[1]["id"]]}})
    check("privacy: other member cannot use a file", s == 404, f"{s}")
if jobs:
    s, out = call("GET", f"/api/jobs/{jobs[0]['id']}")
    check("privacy: other member cannot read a job", s == 404, f"{s}")
opener = mine

# --- account upgrade keeps the work ---------------------------------------------------
email = f"test-{uuid.uuid4().hex[:8]}@example.com"
s, up = call("POST", "/api/auth/signup", {"email": email, "password": "correct horse battery"})
check("signup: guest upgraded in place", s == 200 and up["user"]["isGuest"] is False and up["user"]["id"] == g["user"]["id"], f"{s} {str(up)[:120]}")
s, out = call("POST", "/api/auth/logout")
s, me = call("GET", "/api/auth/me")
check("logout", me.get("user") is None)
s, out = call("POST", "/api/auth/login", {"email": email, "password": "wrong password"})
check("login: wrong password refused", s == 400, f"{s}")
s, out = call("POST", "/api/auth/login", {"email": email, "password": "correct horse battery"})
check("login: works, work is still there", s == 200 and out["user"]["id"] == g["user"]["id"], f"{s}")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
