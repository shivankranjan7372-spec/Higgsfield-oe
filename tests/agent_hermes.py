"""The agent chat on the Hermes engine, against a stand-in Hermes agent.

Runner: own-server. `python3 tests/run.py tests/agent_hermes.py` calls this file as
`agent_hermes.py <app-root> <data-dir> <port>`. It starts a small fake of the agent's API
(`/v1/responses`, streamed) in this process, then the app with AGENT_ENGINE=hermes pointed
at it. The fake calls the app's tools back over MCP the way a real agent does. Nothing
leaves this machine and nothing is spent.
"""
import http.cookiejar
import http.server
import itertools
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request

APP, DATA, PORT = sys.argv[1], sys.argv[2], sys.argv[3]
BASE = f"http://127.0.0.1:{PORT}"
FAKE_PORT = int(PORT) + 11
AGENT_KEY = "fake-agent-key-" + "k" * 20
ENGINE_TOKEN = "fake-engine-token-" + "e" * 20
results = []
ids = itertools.count(1)


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""), flush=True)


# --- the app's tool endpoint, as the agent calls it ---------------------------------

def mcp(method, params=None, *, token=ENGINE_TOKEN, accept="application/json, text/event-stream", notify=False, headers=None, raw=None, verb="POST"):
    msg = {"jsonrpc": "2.0", "method": method}
    if not notify:
        msg["id"] = next(ids)
    if params is not None:
        msg["params"] = params
    h = {"Content-Type": "application/json", "Accept": accept}
    if token:
        h["Authorization"] = f"Bearer {token}"
    h.update(headers or {})
    data = None if verb != "POST" else (raw if raw is not None else json.dumps(msg).encode())
    req = urllib.request.Request(BASE + "/api/agent/mcp", data=data, method=verb, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            status, hdrs, body = res.status, res.headers, res.read().decode()
    except urllib.error.HTTPError as err:
        status, hdrs, body = err.code, err.headers, err.read().decode()
    out = {"status": status, "ctype": hdrs.get("Content-Type", ""), "headers": hdrs, "raw": body, "json": None}
    if "text/event-stream" in out["ctype"]:
        data_lines = [line[6:] for line in body.split("\n") if line.startswith("data: ")]
        out["json"] = json.loads(data_lines[-1]) if data_lines else None
    elif body:
        try:
            out["json"] = json.loads(body)
        except ValueError:
            pass
    return out


# --- a stand-in Hermes agent ----------------------------------------------------------

class Fake:
    requests = []      # every /v1/responses body the app sent
    calls = []         # every tool call the fake made back, with its result
    handshake = None
    tools = []
    disconnects = 0
    keys = []          # turn keys, oldest first
    bad_auth = 0


def tool(name, args):
    """Calls one of the app's tools and returns (text, is_error)."""
    t0 = time.time()
    r = mcp("tools/call", {"name": name, "arguments": args})
    res = (r["json"] or {}).get("result") or {}
    text = "".join(c.get("text", "") for c in res.get("content", []))
    Fake.calls.append({"tool": name, "status": r["status"], "ctype": r["ctype"], "isError": res.get("isError"), "text": text,
                       "pings": r["raw"].count(": ping"), "working": ": working" in r["raw"], "seconds": time.time() - t0, "rpc": r["json"]})
    return text, res.get("isError")


class Out:
    """Writes one streamed answer the way the agent's API server does."""

    def __init__(self, handler):
        self.h, self.open, self.text, self.n = handler, False, "", 0

    def emit(self, kind, **payload):
        self.h.wfile.write(f"event: {kind}\ndata: {json.dumps({'type': kind, **payload})}\n\n".encode())
        self.h.wfile.flush()

    def say(self, s, pause=0.0):
        if not self.open:
            self.open = True
            self.emit("response.output_item.added", output_index=0, item={"id": "msg_1", "type": "message", "status": "in_progress", "role": "assistant", "content": []})
        self.emit("response.output_text.delta", item_id="msg_1", output_index=0, content_index=0, delta=s)
        self.text += s
        if pause:
            time.sleep(pause)

    def tool_start(self, name, args):
        self.n += 1
        cid = f"call_{self.n}"
        self.emit("response.output_item.added", output_index=self.n, item={"id": f"fc_{self.n}", "type": "function_call", "status": "in_progress", "name": name, "call_id": cid, "arguments": json.dumps(args)})
        return cid

    def tool_end(self, cid, name, args, result):
        n = cid.split("_")[1]
        self.emit("response.output_item.done", output_index=int(n), item={"id": f"fc_{n}", "type": "function_call", "status": "completed", "name": name, "call_id": cid, "arguments": json.dumps(args)})
        item = {"id": f"fco_{n}", "type": "function_call_output", "call_id": cid, "output": [{"type": "input_text", "text": result}], "status": "completed"}
        self.emit("response.output_item.added", output_index=int(n), item=item)
        self.emit("response.output_item.done", output_index=int(n), item=item)

    def ours(self, name, args, key):
        """Announce one of the app's tools, call it for real, close it."""
        full = f"mcp__parallax__{name}"
        cid = self.tool_start(full, args)
        text, _ = tool(name, {**args, "turn": key})
        self.tool_end(cid, full, args, text)
        return text

    def finish(self, final=None):
        text = self.text if final is None else final
        if self.open:
            self.emit("response.output_text.done", item_id="msg_1", output_index=0, content_index=0, text=text)
            self.emit("response.output_item.done", output_index=0, item={"id": "msg_1", "type": "message", "status": "completed", "role": "assistant", "content": [{"type": "output_text", "text": text}]})
        self.emit("response.completed", response={"id": "resp_1", "status": "completed"})
        self.h.wfile.write(b"data: [DONE]\n\n")


class Agent(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        body = json.dumps({"status": "ok"}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
        if self.path != "/v1/responses" or self.headers.get("Authorization") != f"Bearer {AGENT_KEY}":
            Fake.bad_auth += 1
            self.send_response(401)
            self.end_headers()
            return
        Fake.requests.append({**body, "_accept": self.headers.get("Accept")})
        said = re.search(r"<member-message>\n(.*)\n</member-message>", body.get("input", ""), re.S)
        text = said.group(1) if said else ""
        found = re.search(r'"turn": "(t_[0-9a-f]{24})"', body.get("instructions", ""))
        key = found.group(1) if found else None
        Fake.keys.append(key)

        if text.startswith("[http-500]"):
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": {"message": "inner detail that members must not see"}}')
            return

        # A real agent connects to its tool servers once, before it answers anything.
        if Fake.handshake is None:
            init = mcp("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "fake-hermes", "version": "0"}})
            note = mcp("notifications/initialized", notify=True)
            listed = mcp("tools/list")
            Fake.handshake = {"init": init, "note": note["status"], "list": listed}
            Fake.tools = ((listed["json"] or {}).get("result") or {}).get("tools", [])

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        out = Out(self)
        try:
            out.emit("response.created", response={"id": "resp_1", "status": "in_progress"})
            self.answer(out, text, key)
        except (BrokenPipeError, ConnectionResetError):
            Fake.disconnects += 1

    def answer(self, out, text, key):
        m = re.match(r"(\[\w[\w-]*\])?\s*generate an? (image|video) of (.+)$", text, re.I)
        if m and m.group(1) == "[race]":
            # The tool call reaches the app before the text that was written ahead of it.
            args = {"kind": m.group(2), "prompt": m.group(3)}
            worker = threading.Thread(target=tool, args=("generate_media", {**args, "turn": key}))
            worker.start()
            time.sleep(0.4)
            out.say("Before the tool. ")
            cid = out.tool_start("mcp__parallax__generate_media", args)
            worker.join()
            out.tool_end(cid, "mcp__parallax__generate_media", args, "ok")
            out.say("After the tool.")
            return out.finish()
        if m:
            out.say("Let me set ", 0.15)
            out.say("that up.", 0.05)
            out.ours("generate_media", {"kind": m.group(2), "prompt": m.group(3)}, key)
            out.say(" Here it is.")
            return out.finish()
        m = re.match(r"\[late\] remember (.+)$", text)
        if m:
            # The stream never shows this call starting until it is already over.
            out.say("One. ")
            first, _ = tool("remember", {"fact": m.group(1), "turn": key})
            cid = out.tool_start("mcp__parallax__remember", {"fact": m.group(1)})
            out.tool_end(cid, "mcp__parallax__remember", {}, first)
            out.ours("recall", {"query": ""}, key)
            out.say("Two.")
            return out.finish()
        m = re.match(r"remember (?:that )?(.+)$", text)
        if m:
            out.ours("remember", {"fact": m.group(1)}, key)
            out.say("Noted.")
            return out.finish()
        if "what do you remember" in text:
            got = out.ours("recall", {"query": ""}, key)
            out.say(f"I remember: {got}")
            return out.finish()
        m = re.match(r"ask me (.+)$", text)
        if m:
            got = out.ours("ask_user", {"question": m.group(1), "choices": ["Yes", "No"]}, key)
            out.say(f"You told me: {got}")
            return out.finish()
        if text.startswith("[own-tools]"):
            out.say("Checking. ")
            a = out.tool_start("tool_search", {"query": "terminal"})
            out.tool_end(a, "tool_search", {}, json.dumps({"tools": []}))
            b = out.tool_start("terminal", {"command": "echo SECRET_ARG_123"})
            time.sleep(0.3)
            out.tool_end(b, "terminal", {}, json.dumps({"output": "SECRET_OUT_456", "exit_code": 0}))
            c = out.tool_start("web_search", {"query": "x"})
            out.tool_end(c, "web_search", {}, json.dumps({"error": "boom"}))
            out.say("All done.")
            return out.finish()
        if text.startswith("[keys]"):
            # Wrong, missing and stale keys must all be refused.
            for label, turn in (("bad", "t_" + "0" * 24), ("none", None), ("old", Fake.keys[-2] if len(Fake.keys) > 1 else "t_x")):
                args = {"query": ""} if turn is None else {"query": "", "turn": turn}
                _, err = tool("recall", args)
                out.say(f"{label}={'refused' if err else 'ran'} ")
            return out.finish()
        if text.startswith("[fail]"):
            out.say("Starting. ")
            return out.emit("response.failed", response={"id": "resp_1", "status": "failed", "error": {"message": "inner detail that members must not see"}})
        if text.startswith("[cut]"):
            out.say("Half an ans")
            time.sleep(0.2)
            return None  # the connection just closes
        if text.startswith("[slow]"):
            for _ in range(200):
                out.say(".", 0.1)
            return out.finish()
        if text.startswith("[leak]"):
            out.say("The key is " + key[:9], 0.4)
            out.say(key[9:] + " and that is all.")
            return out.finish()
        if text.startswith("[commentary]"):
            out.say("First. ")
            cid = out.tool_start("terminal", {})
            item = {"id": "msg_c", "type": "message", "status": "completed", "role": "assistant", "phase": "commentary", "content": [{"type": "output_text", "text": "Working on it."}]}
            out.emit("response.output_item.added", output_index=5, item=item)
            out.emit("response.output_item.done", output_index=5, item=item)
            out.tool_end(cid, "terminal", {}, "{}")
            out.say("Last.")
            return out.finish()
        if text.startswith("[final-differs]"):
            out.say("Hello wrld")
            return out.finish("Hello world")
        if text.startswith("[crlf]"):
            # Windows line ends, cut in the worst places.
            events = [
                ("response.output_item.added", {"item": {"id": "msg_1", "type": "message", "role": "assistant", "content": []}}),
                ("response.output_text.delta", {"delta": "CR"}),
                ("response.output_text.delta", {"delta": "LF ok"}),
                ("response.completed", {"response": {"id": "resp_1"}}),
            ]
            blob = b"".join(f": keepalive\r\n\r\nevent: {k}\r\ndata: {json.dumps({'type': k, **p})}\r\n\r\n".encode() for k, p in events)
            parts = blob.split(b"\r\n\r\n")
            for i, part in enumerate(parts[:-1]):
                head, tail = (b"\r\n\r", b"\n") if i % 2 else (b"\r", b"\n\r\n")
                self.wfile.write(part + head)
                self.wfile.flush()
                time.sleep(0.05)
                self.wfile.write(tail)
            return None
        out.say("You said: ", 0.15)
        out.say(text, 0.15)
        out.say(" Bye.")
        return out.finish()


# --- the app -------------------------------------------------------------------------

def boot(log, **extra):
    env = dict(os.environ, TREG_MODE="mock", AGENT_MODE="mock", MOCK_DELAY_MS="300", PARALLAX_DATA_DIR=DATA, PARALLAX_DEMO_BILLING="1",
               AGENT_ENGINE="hermes", HERMES_URL=f"http://127.0.0.1:{FAKE_PORT}/", AGENT_ENGINE_NAME="Doug", AGENT_ALLOWED_EMAILS="*", **extra)
    return subprocess.Popen(["node", "node_modules/next/dist/bin/next", "start", "-p", PORT], cwd=APP, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)


def halt(proc):
    if proc.poll() is None:
        os.killpg(proc.pid, signal.SIGTERM)
        try:
            proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)


def wait_port():
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/auth/me", timeout=2).read()
            return True
        except urllib.error.HTTPError:
            return True
        except Exception:
            time.sleep(0.25)
    return False


A = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
    try:
        with A.open(req, timeout=60) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as err:
        try:
            return err.code, json.loads(err.read() or b"{}")
        except ValueError:
            return err.code, {}


def wait_for(fn, seconds=30, step=0.2):
    deadline = time.time() + seconds
    while time.time() < deadline:
        v = fn()
        if v:
            return v
        time.sleep(step)
    return None


def latest(chat_id):
    _, out = call("GET", f"/api/agent/chats/{chat_id}/rows?after=0")
    by_seq = {r["seq"]: r for r in out.get("rows", [])}
    return [by_seq[k] for k in sorted(by_seq)]


def idle(chat_id):
    _, out = call("GET", f"/api/agent/chats/{chat_id}")
    return out.get("chat", {}).get("state") == "idle" and all(t["status"] not in ("queued", "running", "waiting") for t in out.get("turns", []))


def cards(chat_id, card=None, status=None):
    return [r for r in latest(chat_id) if r["kind"] == "card" and (card is None or r["body"].get("card") == card) and (status is None or r["body"].get("status") == status)]


def send(chat_id, text, **extra):
    return call("POST", f"/api/agent/chats/{chat_id}/messages", {"text": text, **extra})


def turn(chat_id, text, seconds=30, **extra):
    """Sends one message, waits for the reply to finish, returns the rows it added."""
    before = {r["seq"] for r in latest(chat_id)}
    send(chat_id, text, **extra)
    time.sleep(0.3)
    wait_for(lambda: idle(chat_id), seconds)
    return [r for r in latest(chat_id) if r["seq"] not in before]


def shape(rows):
    """Rows as short labels, in order: what a member would see down the page."""
    out = []
    for r in rows:
        b = r["body"]
        if r["kind"] == "message":
            out.append(f"{b.get('role')}:{b.get('text')}")
        elif r["kind"] == "tool-call":
            out.append(f"tool:{b.get('tool')}:{b.get('status')}")
        elif r["kind"] == "card":
            out.append(f"card:{b.get('card')}:{b.get('status')}")
        elif r["kind"] == "notice":
            out.append(f"notice:{b.get('code')}")
    return out


def balance():
    return call("GET", "/api/auth/me")[1].get("balance")


shutil.rmtree(DATA, ignore_errors=True)
os.makedirs(DATA)
logs = os.path.join(os.path.dirname(DATA), "logs")
key_file = os.path.join(os.path.dirname(DATA), "agent.key")
with open(key_file, "w") as f:
    f.write(AGENT_KEY + "\n")
os.chmod(key_file, 0o600)

agent = http.server.ThreadingHTTPServer(("127.0.0.1", FAKE_PORT), Agent)
agent.daemon_threads = True
threading.Thread(target=agent.serve_forever, daemon=True).start()

# --- half-set settings fall back to the built-in engine --------------------------------
log0 = open(os.path.join(logs, "hermes-off.log"), "w")
off = boot(log0, HERMES_API_KEY_FILE=key_file, AGENT_ENGINE_TOKEN="too-short")
check("server up (weak engine token)", wait_port())
call("POST", "/api/auth/guest")
s, cfg = call("GET", "/api/agent/config")
check("weak token: the built-in engine stays in charge", s == 200 and cfg.get("engine", {}).get("id") == "builtin" and cfg["services"]["llm"] == "mock" and len(cfg["models"]) > 1, str(cfg.get("engine")))
r = mcp("ping", token="too-short")
check("weak token: the tool endpoint does not exist", r["status"] == 404, f"{r['status']}")
halt(off)
log0.close()
with open(os.path.join(logs, "hermes-off.log")) as f:
    off_log = f.read()
check("weak token: the server says what is missing, without the value", "AGENT_ENGINE_TOKEN" in off_log and "too-short" not in off_log, off_log[-200:])
A = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
shutil.rmtree(DATA, ignore_errors=True)
os.makedirs(DATA)

# --- the Hermes engine -----------------------------------------------------------------
log = open(os.path.join(logs, "hermes.log"), "w")
server = boot(log, HERMES_API_KEY_FILE=key_file, AGENT_ENGINE_TOKEN=ENGINE_TOKEN)
try:
    check("server up (Hermes engine)", wait_port())
    s, g = call("POST", "/api/auth/guest")
    check("guest account", s == 200, f"{s}")
    s, cfg = call("GET", "/api/agent/config")
    check("config: the engine is named", cfg.get("engine") == {"id": "hermes", "name": "Doug"}, str(cfg.get("engine")))
    check("config: one model choice, named after the engine", [(m["id"], m["name"]) for m in cfg.get("models", [])] == [("auto", "Doug")], str(cfg.get("models")))
    check("config: the assistant counts as live, the rest as stand-ins", cfg.get("services") == {"llm": "live", "computer": "mock", "connectors": "mock"}, str(cfg.get("services")))

    # --- the tool endpoint, called directly ---
    r = mcp("ping", token=None)
    check("endpoint: no token is 401", r["status"] == 401 and "Bearer" in (r["headers"].get("WWW-Authenticate") or ""), f"{r['status']}")
    r = mcp("ping", token="wrong-" + "x" * 30)
    check("endpoint: wrong token is 401", r["status"] == 401 and (r["json"] or {}).get("error", {}).get("code") == "unauthorized", f"{r['status']}")
    r = mcp("ping", token=AGENT_KEY)
    check("endpoint: the agent's own API key is not the engine token", r["status"] == 401, f"{r['status']}")
    r = mcp("ping", verb="GET")
    check("endpoint: GET is 405", r["status"] == 405 and r["headers"].get("Allow") == "POST", f"{r['status']}")
    r = mcp("ping", headers={"Origin": "https://evil.example"})
    check("endpoint: cross-site call refused", r["status"] == 403, f"{r['status']}")
    r = mcp("ping", raw=b"{not json")
    check("endpoint: bad JSON is a parse error", r["status"] == 400 and r["json"]["error"]["code"] == -32700, f"{r['status']}")
    r = mcp("ping")
    check("endpoint: ping", r["status"] == 200 and r["json"].get("result") == {}, str(r["json"]))
    r = mcp("nope/nothing")
    check("endpoint: unknown method", r["json"]["error"]["code"] == -32601, str(r["json"]))
    r = mcp("server/discover", {"_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28"}})
    check("endpoint: discovery for newer clients", r["status"] == 200 and "2026-07-28" in r["json"]["result"]["supportedVersions"] and r["json"]["result"].get("resultType") == "complete", str(r["json"])[:200])
    r = mcp("tools/call", {"name": "delete_everything", "arguments": {}})
    check("endpoint: unknown tool", r["json"].get("error", {}).get("code") == -32602, str(r["json"])[:160])
    r = mcp("tools/call", {"name": "recall", "arguments": {"query": ""}}, accept="application/json")
    check("endpoint: a call with no turn key is refused, as plain JSON when asked", r["status"] == 200 and "application/json" in r["ctype"] and r["json"]["result"]["isError"] is True, str(r["json"])[:200])
    r = mcp("tools/call", {"name": "recall", "arguments": {"query": "", "turn": "t_" + "a" * 24}})
    check("endpoint: a made-up turn key is refused, as a stream when accepted", "text/event-stream" in r["ctype"] and "event: message" in r["raw"] and r["json"]["result"]["isError"] is True, r["raw"][:200])

    s, out = call("POST", "/api/agent/chats", {})
    cid = out["chat"]["id"]

    # --- who may use a live agent ---
    s, out = send(cid, "hello there")
    check("access: a guest cannot use a live agent", s == 403 and out.get("error", {}).get("code") == "agent_restricted", f"{s} {out}")
    s, out = call("POST", "/api/auth/signup", {"email": f"hermes-{int(time.time())}@example.com", "password": "hermes-pass-1234", "name": "Hermes Tester"})
    check("access: the guest signs up and keeps the chat", s == 200, f"{s} {out}")

    # --- a plain reply ---
    new = turn(cid, "hello there")
    check("reply: the agent's text is the reply", shape(new) == ["user:hello there", "assistant:You said: hello there Bye."], str(shape(new)))
    reply = [r for r in new if r["body"].get("role") == "assistant"]
    check("reply: it streamed and then settled", reply and reply[0]["updatedSeq"] > reply[0]["seq"] and reply[0]["body"]["streaming"] is False, str(reply)[:200])
    req = Fake.requests[-1]
    check("request: streamed, stored, one conversation per chat", req.get("stream") is True and req.get("store") is True and req.get("conversation") == f"parallax-{cid}" and req.get("model") == "hermes-agent" and "text/event-stream" in (req.get("_accept") or ""), str({k: req.get(k) for k in ("stream", "store", "conversation", "model")}))
    check("request: instructions name our tools and carry a turn key", "mcp__parallax__generate_media" in req.get("instructions", "") and Fake.keys[-1], str(Fake.keys[-1])[:4])
    check("request: the agent's key was accepted, nothing else was sent to it", Fake.bad_auth == 0 and ENGINE_TOKEN not in json.dumps(req), f"{Fake.bad_auth}")
    hs = Fake.handshake or {}
    check("handshake: initialize, then the notification gets 202", hs and hs["init"]["json"]["result"]["protocolVersion"] == "2025-06-18" and hs["note"] == 202, str(hs.get("note")))
    names = {t["name"] for t in Fake.tools}
    check("tools: generation, registry, library, memory and questions are offered", {"generate_media", "list_models", "get_model", "quote", "search_library", "get_asset", "remember", "recall", "ask_user"} <= names, str(sorted(names)))
    check("tools: stand-in services are not offered", not any(n.startswith(("computer_", "app_")) or n in ("connect_app", "list_connectors") for n in names), str(sorted(names)))
    check("tools: every one requires the turn key", Fake.tools and all("turn" in t["inputSchema"].get("required", []) and "turn" in t["inputSchema"]["properties"] for t in Fake.tools), "")

    # --- generate, asking first ---
    call("POST", "/api/wallet/topup", {"packId": "pack-500"})
    start = balance()
    send(cid, "generate an image of a red fox in snow")
    card = wait_for(lambda: cards(cid, "approval", "pending"), 20)
    check("generate(ask): the member gets an approval card", card and "red fox" in card[0]["body"].get("prompt", "") and card[0]["body"].get("price", 0) > 0, str(card[0]["body"] if card else None)[:200])
    check("generate(ask): nothing spent while it waits", balance() == start, "")
    time.sleep(16.5)  # long enough that the open tool call must be kept alive
    price = card[0]["body"]["price"] if card else 0
    if card:
        s, out = call("POST", f"/api/agent/approvals/{card[0]['body']['approvalId']}", {"decision": "allow"})
        check("generate(ask): allow accepted", s == 200, f"{s}")
    wait_for(lambda: idle(cid), 60)
    rows = [r for r in latest(cid) if r["seq"] > reply[0]["seq"]]
    got = shape(rows)
    check("generate(ask): text, then the tool, then its cards, then text", got == ["user:generate an image of a red fox in snow", "assistant:Let me set that up.", "tool:generate_media:done", "card:approval:allowed", "card:result:succeeded", "assistant:Here it is."], str(got))
    check("generate(ask): charged exactly the shown price", price > 0 and balance() == start - price, f"{start} -> {balance()} price={price}")
    gen = [c for c in Fake.calls if c["tool"] == "generate_media"][-1]
    check("generate(ask): the long call was answered as a stream and kept alive", "text/event-stream" in gen["ctype"] and gen["working"] and gen["pings"] >= 1 and gen["seconds"] > 15, f"pings={gen['pings']} seconds={gen['seconds']:.1f}")
    check("generate(ask): the agent got the file ids back, not an error", gen["isError"] is False and "ast_" in gen["text"], gen["text"][:160])
    s, lib = call("GET", "/api/assets?kind=image")
    check("generate(ask): the picture is in the member's library", len(lib.get("assets", [])) == 1, f"{len(lib.get('assets', []))}")

    # --- generate without asking; a denied card ---
    new = turn(cid, "generate an image of a blue heron", 60, mode="auto")
    check("generate(auto): no approval card, straight to the result", shape(new)[1:] == ["assistant:Let me set that up.", "tool:generate_media:done", "card:result:succeeded", "assistant:Here it is."], str(shape(new)))
    before = balance()
    send(cid, "generate an image of a lantern")
    card = wait_for(lambda: cards(cid, "approval", "pending"), 20)
    if card:
        call("POST", f"/api/agent/approvals/{card[0]['body']['approvalId']}", {"decision": "deny"})
    wait_for(lambda: idle(cid), 30)
    check("generate(ask): denied means no spend, and the agent is told", balance() == before and "denied" in Fake.calls[-1]["text"].lower(), Fake.calls[-1]["text"][:120])

    # --- row order when the call and the stream race ---
    new = turn(cid, "[race] generate an image of a paper boat", 60, mode="auto")
    check("order: text written before a tool lands before it, even when the call arrives first", shape(new)[1:] == ["assistant:Before the tool.", "tool:generate_media:done", "card:result:succeeded", "assistant:After the tool."], str(shape(new)))
    new = turn(cid, "[late] remember I like teal")
    check("order: a call the stream never announced still runs, in order", shape(new)[1:] == ["assistant:One.", "tool:remember:done", "tool:recall:done", "assistant:Two."], str(shape(new)))
    late = [c for c in Fake.calls if c["tool"] == "remember"][-1]
    check("order: it waited a moment for the stream, not forever", 1.2 < late["seconds"] < 4, f"{late['seconds']:.2f}s")

    # --- memory and questions go through Parallax ---
    new = turn(cid, "what do you remember")
    check("memory: recall reads the member's own notes", any("teal" in r["body"].get("text", "") for r in new if r["kind"] == "message"), str(shape(new)))
    s, mem = call("GET", "/api/agent/memory")
    check("memory: saved in Parallax, where the member can see it", any("teal" in m["text"] for m in mem.get("memories", [])), str(mem)[:160])
    send(cid, "ask me whether blue works")
    q = wait_for(lambda: cards(cid, "question", "pending"), 20)
    check("ask_user: a question card with choices", q and q[0]["body"]["choices"] == ["Yes", "No"], str(q[0]["body"] if q else None)[:160])
    if q:
        call("POST", f"/api/agent/approvals/{q[0]['body']['approvalId']}", {"choice": "Yes"})
    wait_for(lambda: idle(cid), 20)
    check("ask_user: the answer reaches the agent", "You told me: The member answered" in latest(cid)[-1]["body"].get("text", ""), str(latest(cid)[-1]["body"])[:160])

    # --- the agent's own tools ---
    new = turn(cid, "[own-tools] look around")
    got = shape(new)[1:]
    check("own tools: shown as steps, lookups hidden, failures marked", got == ["assistant:Checking.", "tool:engine.terminal:done", "tool:engine.web_search:error", "assistant:All done."], str(got))
    own = [r["body"] for r in new if r["kind"] == "tool-call"]
    check("own tools: a readable label, and no input or output kept", own and own[0].get("summary") == "Terminal" and own[0].get("input") == {} and "SECRET" not in json.dumps(new), str(own)[:200])

    # --- turn keys ---
    new = turn(cid, "[keys] try them")
    check("keys: wrong, missing and last message's keys are all refused", shape(new)[1:] == ["assistant:bad=refused none=refused old=refused"], str(shape(new)))
    check("keys: each message gets a new one", len(set(Fake.keys)) == len(Fake.keys) and all(k and re.fullmatch(r"t_[0-9a-f]{24}", k) for k in Fake.keys), f"{len(Fake.keys)} keys")
    r = mcp("tools/call", {"name": "recall", "arguments": {"query": "", "turn": Fake.keys[-1]}})
    check("keys: a key stops working when its reply ends", r["json"]["result"]["isError"] is True, str(r["json"])[:160])

    events = []

    def listen():
        try:
            with A.open(urllib.request.Request(BASE + "/api/agent/events"), timeout=60) as res:
                name = None
                for line in res:
                    line = line.decode("utf8").rstrip("\n")
                    if line.startswith("event: "):
                        name = line[7:]
                    elif line.startswith("data: ") and name:
                        events.append((name, line[6:]))
                        name = None
        except Exception:
            pass

    threading.Thread(target=listen, daemon=True).start()
    wait_for(lambda: any(e[0] == "ready" for e in events), 10)
    new = turn(cid, "[leak] say it")
    leaked = Fake.keys[-1]
    check("keys: one the agent repeats is cut from the reply", shape(new)[1:] == ["assistant:The key is  and that is all."], str(shape(new)))
    writes = [e[1] for e in events if e[0] == "row" and "The key is" in e[1]]
    check("keys: not even half of it shows while the reply streams", len(writes) >= 2 and not any(leaked[:6] in w for w in writes), f"{len(writes)} writes")
    db = b""
    for name in os.listdir(DATA):
        if name.startswith("parallax.db"):
            with open(os.path.join(DATA, name), "rb") as f:
                db += f.read()
    check("keys: none is stored", not any(k.encode() in db for k in Fake.keys), "")

    # --- shapes of the stream ---
    new = turn(cid, "[commentary] go")
    check("stream: a note between steps is its own reply, once", shape(new)[1:] == ["assistant:First.", "tool:engine.terminal:done", "assistant:Working on it.", "assistant:Last."], str(shape(new)))
    new = turn(cid, "[final-differs] go")
    check("stream: the agent's final text wins over what streamed", shape(new)[1:] == ["assistant:Hello world"], str(shape(new)))
    new = turn(cid, "[crlf] go")
    check("stream: other line ends, cut anywhere, still parse", shape(new)[1:] == ["assistant:CRLF ok"], str(shape(new)))

    # --- failures and stopping ---
    new = turn(cid, "[fail] go")
    check("failure: a failed answer keeps its text and posts a plain notice", shape(new)[1:] == ["assistant:Starting.", "notice:turn_failed"] and "inner detail" not in json.dumps(new), str(shape(new)))
    new = turn(cid, "[http-500] go")
    check("failure: an agent that errors posts the same notice", shape(new)[1:] == ["notice:turn_failed"] and "inner detail" not in json.dumps(new), str(shape(new)))
    new = turn(cid, "[cut] go")
    check("failure: an answer that breaks off is a failure, not a reply", shape(new)[1:] == ["assistant:Half an ans", "notice:turn_failed"] and new[1]["body"]["streaming"] is False, str(shape(new)))
    _, detail = call("GET", f"/api/agent/chats/{cid}")
    check("failure: the turn is marked failed", [t["status"] for t in detail.get("turns", [])][:3] == ["failed"] * 3, str([t["status"] for t in detail.get("turns", [])][:3]))
    seen = Fake.disconnects
    send(cid, "[slow] take your time")
    time.sleep(1.0)
    s, out = call("POST", f"/api/agent/chats/{cid}/stop")
    check("stop: accepted", s == 200 and out.get("stopped") is True, f"{s} {out}")
    wait_for(lambda: idle(cid), 20)
    tail = latest(cid)[-2:]
    check("stop: the reply ends where it was, with a notice", len(tail) == 2 and tail[0]["body"].get("streaming") is False and tail[0]["body"].get("text", "").startswith("..") and tail[1]["body"].get("code") == "stopped", str(shape(tail)))
    check("stop: the agent is cut off too", wait_for(lambda: Fake.disconnects > seen, 5), f"{Fake.disconnects - seen} disconnects")
    new = turn(cid, "still there?")
    check("after all that, the chat still works", shape(new) == ["user:still there?", "assistant:You said: still there? Bye."], str(shape(new)))

    # --- incognito ---
    s, out = call("POST", "/api/agent/chats", {"incognito": True})
    icid = out["chat"]["id"]
    turn(icid, "remember that my secret is plum")
    s, mem = call("GET", "/api/agent/memory")
    check("incognito: nothing saved, and the agent is told to save nothing either", not any("plum" in m["text"] for m in mem.get("memories", [])) and "incognito" in Fake.requests[-1]["instructions"], str(mem)[:120])

    # --- guessing the token gets slower, the real engine is not locked out ---
    codes = [mcp("ping", token="guess-%02d-" % i + "x" * 24)["status"] for i in range(24)]
    check("endpoint: repeated wrong tokens are throttled", codes[0] == 401 and codes[-1] == 429, str(codes[-6:]))
    check("endpoint: the engine's own calls are not", mcp("ping")["status"] == 200, "")
finally:
    halt(server)
    log.close()
    agent.shutdown()

with open(os.path.join(logs, "hermes.log")) as f:
    text = f.read()
check("log: no key, token or turn key is written", not any(x in text for x in [AGENT_KEY, ENGINE_TOKEN] + [k for k in Fake.keys if k]), "")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
