"""Runs API tests against the built app in mock mode.

Usage: python3 tests/run.py tests/core_e2e.py [tests/more.py ...]

Run `npm run build` first. Each test file gets its own server on a fresh, empty
data folder, and is called as `python3 <test> <base-url>`. Mock mode never calls
a provider and never spends money. Set PORT to change the port (default 3190).
Set MOCK_DELAY_MS to slow the mock models down.

A test that has to start and kill the server itself (a crash test) says so with
the line `Runner: own-server` near its top. It gets no server from here and is
called as `python3 <test> <app-root> <data-dir> <port>` instead.

A browser walk-through is a `.mjs` file under tests/ui/. It is called as
`node <test> <base-url> <out-dir> [width height]` and saves its screenshots in
`ui-shots/<name>/`. Set UI_SIZE="390 844" to run it at phone size; those
screenshots go to `ui-shots/<name>-390/`. It needs Chrome (set CHROME_BIN if it
is not in a usual place) and always uses a throwaway browser profile.
"""
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.request

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = os.environ.get("PORT", "3190")
BASE = f"http://127.0.0.1:{PORT}"


def hosts_itself(test: str) -> bool:
    with open(test, encoding="utf-8") as source:
        return "runner: own-server" in source.read(800).lower()


def command(test: str) -> list[str]:
    """How to call one test once the server is up."""
    if not test.endswith(".mjs"):
        return [sys.executable, test, BASE]
    size = os.environ.get("UI_SIZE", "").split()
    name = os.path.splitext(os.path.basename(test))[0] + (f"-{size[0]}" if size else "")
    return ["node", test, BASE, os.path.join(APP, "ui-shots", name), *size[:2]]


def keep_or_clean(data: str, code: int) -> int:
    if code == 0:
        shutil.rmtree(data, ignore_errors=True)
    else:
        print(f"kept the data folder for debugging: {data}")
    return code


def run_one(test: str) -> int:
    data = tempfile.mkdtemp(prefix="parallax-test-")
    # Tests never see a real key: outside services run as mocks, and key variables are removed.
    env = {k: v for k, v in os.environ.items() if not k.endswith(("_API_KEY", "_TOKEN"))}
    env.update(TREG_MODE="mock", AGENT_MODE="mock", PARALLAX_DATA_DIR=data, PARALLAX_DEMO_BILLING="1")
    if hosts_itself(test):
        os.makedirs(os.path.join(data, "logs"))
        own = [sys.executable, test, APP, os.path.join(data, "data"), PORT]
        return keep_or_clean(data, subprocess.call(own, cwd=APP, env=env))
    log_path = os.path.join(data, "server.log")
    with open(log_path, "wb") as log:
        server = subprocess.Popen(
            ["node", "node_modules/next/dist/bin/next", "start", "-p", PORT],
            cwd=APP, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
        )
        code = 1
        try:
            up = False
            for _ in range(60):
                try:
                    urllib.request.urlopen(BASE + "/api/auth/me", timeout=3)
                    up = True
                    break
                except Exception:
                    if server.poll() is not None:
                        break
                    time.sleep(1)
            if not up:
                print(f"server did not start. Did you run `npm run build`? Log: {log_path}")
                return 1
            code = subprocess.call(command(test), cwd=APP)
        finally:
            if server.poll() is None:
                os.killpg(server.pid, signal.SIGTERM)
                try:
                    server.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    os.killpg(server.pid, signal.SIGKILL)
    return keep_or_clean(data, code)


def main() -> int:
    tests = sys.argv[1:]
    if not tests:
        print(__doc__)
        return 2
    failed = []
    for test in tests:
        print(f"\n=== {test}", flush=True)
        if run_one(test) != 0:
            failed.append(test)
    print("\n" + ("ALL TEST FILES PASSED" if not failed else "FAILED: " + ", ".join(failed)))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
