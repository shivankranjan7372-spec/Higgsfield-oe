"""Developer API, webhooks and MCP, in mock mode. Usage: developer.py <base-url>

Webhook delivery checks need the server started with PARALLAX_ALLOW_LOCAL_WEBHOOKS=1
(so it may call http://127.0.0.1). Without it, the test checks that the local URL is
refused instead, and says so.
"""
import hashlib
import hmac
import http.cookiejar
import http.server
import json
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

BASE = sys.argv[1].rstrip("/")
results = []


class Client:
    """A browser-like client with its own cookie jar (a member's session)."""

    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, method, path, body=None, headers=None, raw=False):
        return send(self.opener, method, path, body, headers, raw)


plain = urllib.request.build_opener()


def send(opener, method, path, body=None, headers=None, raw=False):
    data = None
    h = dict(headers or {})
    if body is not None and not isinstance(body, bytes):
        data = json.dumps(body).encode()
        h.setdefault("Content-Type", "application/json")
    elif body is not None:
        data = body
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with opener.open(req, timeout=60) as res:
            payload, status, hdrs = res.read(), res.status, res.headers
    except urllib.error.HTTPError as err:
        payload, status, hdrs = err.read(), err.code, err.headers
    if raw:
        return status, hdrs, payload
    try:
        return status, json.loads(payload or b"{}")
    except ValueError:
        return status, {"_text": payload[:200].decode("utf8", "replace")}


def api(key, method, path, body=None, headers=None, raw=False):
    h = dict(headers or {})
    if key:
        h["Authorization"] = f"Bearer {key}"
    return send(plain, method, "/api" + path, body, h, raw)


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def err_code(out):
    return (out.get("error") or {}).get("code")


def multipart(field, filename, content):
    boundary = uuid.uuid4().hex
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
        + content
        + f"\r\n--{boundary}--\r\n".encode()
    )
    return body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def wait_generation(key, gid, seconds=60):
    deadline = time.time() + seconds
    g = {}
    while time.time() < deadline:
        _, out = api(key, "GET", f"/v1/generations/{gid}")
        g = out.get("generation", {})
        if g.get("status") in ("succeeded", "failed", "canceled"):
            break
        time.sleep(0.5)
    return g


# --- webhook receiver ----------------------------------------------------------
received = []


class Receiver(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
        received.append({"path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()}, "body": body})
        self.send_response(500 if self.path.startswith("/fail") else 200)
        self.end_headers()

    def log_message(self, *args):
        pass


receiver = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Receiver)
threading.Thread(target=receiver.serve_forever, daemon=True).start()
HOOK = f"http://127.0.0.1:{receiver.server_address[1]}"


def signature_ok(secret, item):
    ts = item["headers"].get("parallax-webhook-timestamp", "")
    want = "v1=" + hmac.new(secret.encode(), f"{ts}.".encode() + item["body"], hashlib.sha256).hexdigest()
    fresh = ts.isdigit() and abs(time.time() - int(ts)) < 300
    return fresh and hmac.compare_digest(want, item["headers"].get("parallax-webhook-signature", ""))


def wait_received(pred, seconds=20):
    deadline = time.time() + seconds
    while time.time() < deadline:
        for item in received:
            if pred(item):
                return item
        time.sleep(0.3)
    return None


# --- accounts ------------------------------------------------------------------
for _ in range(60):
    try:
        if Client().call("GET", "/api/auth/me")[0] == 200:
            break
    except Exception:
        pass
    time.sleep(1)

a, b, guest, anon = Client(), Client(), Client(), Client()
s, _ = a.call("POST", "/api/auth/signup", {"email": f"dev-a-{uuid.uuid4().hex[:8]}@example.com", "password": "correct horse battery"})
check("setup: member A signed up", s == 200, f"{s}")
s, _ = b.call("POST", "/api/auth/signup", {"email": f"dev-b-{uuid.uuid4().hex[:8]}@example.com", "password": "correct horse battery"})
check("setup: member B signed up", s == 200, f"{s}")
guest.call("POST", "/api/auth/guest")

# --- keys ----------------------------------------------------------------------
s, out = anon.call("GET", "/api/developer/keys")
check("keys: signed out is 401", s == 401 and err_code(out) == "unauthorized", f"{s}")
s, out = guest.call("POST", "/api/developer/keys", {"name": "g"})
check("keys: guest refused", s == 403 and err_code(out) == "account_required", f"{s} {out}")
s, out = a.call("POST", "/api/developer/keys", {"name": "x", "scopes": ["admin"]})
check("keys: unknown scope refused", s == 400, f"{s}")
s, out = a.call("POST", "/api/developer/keys", {"name": 5})
check("keys: non-text name refused", s == 400, f"{s}")
s, out = a.call("POST", "/api/developer/keys", {"name": "Main", "scopes": ["read", "generate"]})
KEY_A = out.get("secret", "")
check("keys: created, secret shown once", s == 201 and KEY_A.startswith("pxk_") and out["key"]["scopes"] == ["read", "generate"], f"{s} {str(out)[:120]}")
KEY_A_ID = out.get("key", {}).get("id")
s, out = a.call("POST", "/api/developer/keys", {"name": "Read only", "scopes": ["read"]})
KEY_A_RO, KEY_A_RO_ID = out.get("secret", ""), out.get("key", {}).get("id")
s, out = a.call("GET", "/api/developer/keys")
check("keys: list never includes the secret", s == 200 and len(out["keys"]) == 2 and KEY_A not in json.dumps(out) and "key_hash" not in json.dumps(out), f"{s}")
s, out = a.call("PATCH", f"/api/developer/keys/{KEY_A_ID}", {"name": "Main key"})
check("keys: rename", s == 200 and out["key"]["name"] == "Main key", f"{s}")
s, out = b.call("PATCH", f"/api/developer/keys/{KEY_A_ID}", {"name": "mine now"})
check("keys: other member's key is 404", s == 404, f"{s}")
s, out = a.call("POST", "/api/developer/keys", {"name": "x"}, headers={"Origin": "https://evil.example"})
check("keys: cross-site create refused", s == 403, f"{s}")
s, out = b.call("POST", "/api/developer/keys", {"name": "B"})
KEY_B = out.get("secret", "")

# --- auth on /v1 ---------------------------------------------------------------
s, out = api(None, "GET", "/v1/models")
check("v1: no key is 401", s == 401 and err_code(out) == "unauthorized", f"{s}")
s, out = api("pxk_not_a_real_key", "GET", "/v1/models")
check("v1: unknown key is 401", s == 401, f"{s}")
s, out = a.call("GET", "/api/v1/balance")
check("v1: a session cookie is not enough", s == 401, f"{s}")

# --- models + quote ------------------------------------------------------------
s, h, body = api(KEY_A, "GET", "/v1/models", raw=True)
models = json.loads(body).get("models", []) if s == 200 else []
check("models: listed", s == 200 and any(m["id"] == "flux-schnell" for m in models) and "build" not in body.decode(), f"{s} {len(models)}")
check("models: rate limit headers", h.get("X-RateLimit-Limit") and h.get("X-RateLimit-Remaining") and h.get("X-RateLimit-Reset"), str(dict(h))[:120])
s, out = api(KEY_A, "GET", "/v1/models?kind=sculpture")
check("models: bad kind is 400", s == 400, f"{s}")
s, out = api(KEY_A, "GET", "/v1/models/flux-schnell")
check("models: one model with controls and slots", s == 200 and isinstance(out["model"].get("controls"), list) and "slots" in out["model"], f"{s}")
s, out = api(KEY_A, "GET", "/v1/models/no-such-model")
check("models: unknown is 404", s == 404, f"{s}")

s, bal0 = api(KEY_A, "GET", "/v1/balance")
check("balance: read", s == 200 and isinstance(bal0.get("balance"), int) and bal0["plan"]["id"], f"{s} {bal0}")
s, q = api(KEY_A_RO, "POST", "/v1/quote", {"modelId": "flux-schnell", "prompt": "a red kite", "count": 2})
check("quote: priced with a read key", s == 200 and q["credits"] > 0 and q["generations"] * q["resultsPerGeneration"] == 2 and q["affordable"] is True, f"{s} {str(q)[:160]}")
s, bal1 = api(KEY_A, "GET", "/v1/balance")
check("quote: spends nothing", bal1.get("balance") == bal0.get("balance"), f"{bal0.get('balance')} -> {bal1.get('balance')}")
s, out = api(KEY_A, "POST", "/v1/quote", {"prompt": "x"})
check("quote: missing model is 400", s == 400, f"{s}")
s, out = api(KEY_A, "POST", "/v1/quote", b"not json", headers={"Content-Type": "application/json"})
check("quote: non-JSON body is 400", s == 400, f"{s}")

# --- generations ---------------------------------------------------------------
draft = {"modelId": "flux-schnell", "prompt": "a lighthouse in fog", "values": {"aspect": "16:9"}}
s, out = api(KEY_A_RO, "POST", "/v1/generations", draft)
check("generate: read-only key refused", s == 403 and err_code(out) == "forbidden", f"{s}")
s, out = api(KEY_A, "POST", "/v1/generations", {"modelId": "flux-schnell", "prompt": "x" * 100000})
check("generate: overlong prompt is 400", s == 400, f"{s}")
s, out = api(KEY_A, "POST", "/v1/generations", {"modelId": "nope", "prompt": "x"})
check("generate: unknown model is 400", s == 400, f"{s}")
idem = uuid.uuid4().hex
s, h, body = api(KEY_A, "POST", "/v1/generations", draft, headers={"Idempotency-Key": idem}, raw=True)
out = json.loads(body)
gens = out.get("generations", [])
GEN = gens[0]["id"] if gens else None
check("generate: queued", s == 201 and GEN and gens[0]["status"] in ("queued", "running") and gens[0]["surface"] == "api", f"{s} {str(out)[:160]}")
cost = gens[0]["cost"] if gens else 0
s, h, body = api(KEY_A, "POST", "/v1/generations", draft, headers={"Idempotency-Key": idem}, raw=True)
again = json.loads(body)
check("generate: same Idempotency-Key replays", s == 200 and h.get("Idempotent-Replayed") == "true" and [g["id"] for g in again.get("generations", [])] == [GEN], f"{s}")
s, out = api(KEY_A, "POST", "/v1/generations", dict(draft, prompt="something else"), headers={"Idempotency-Key": idem})
check("generate: reused key with another body is 422", s == 422 and err_code(out) == "idempotency_mismatch", f"{s}")
s, bal2 = api(KEY_A, "GET", "/v1/balance")
check("generate: credits held once", bal2["balance"] == bal0["balance"] - cost, f"{bal0['balance']} - {cost} -> {bal2['balance']}")

g = wait_generation(KEY_A, GEN)
check("generate: succeeded with files", g.get("status") == "succeeded" and len(g.get("files", [])) >= 1, f"{g.get('status')} {g.get('error')}")
FILE = g["files"][0] if g.get("files") else {}
s, h, png = api(KEY_A, "GET", FILE.get("url", "/v1/files/x/content").replace("/api", "", 1), raw=True)
check("files: bytes with the key", s == 200 and len(png) > 100 and h.get("Content-Type", "").startswith("image/"), f"{s} {len(png)}")
s, out = api(None, "GET", f"/v1/files/{FILE.get('id')}/content")
check("files: bytes without a key is 401", s == 401, f"{s}")

s, out = api(KEY_A, "GET", "/v1/generations?limit=5")
check("generations: listed", s == 200 and any(x["id"] == GEN for x in out.get("generations", [])), f"{s}")
s, out = api(KEY_A, "GET", "/v1/generations?kind=nope")
check("generations: bad kind is 400", s == 400, f"{s}")
s, out = api(KEY_A, "POST", f"/v1/generations/{GEN}/cancel")
check("cancel: finished one is 409", s == 409 and err_code(out) == "not_cancelable", f"{s} {out}")
s, out = api(KEY_A, "POST", "/v1/generations", {"modelId": "flux-schnell", "prompt": "cancel me"})
cid = out["generations"][0]["id"] if s == 201 else "x"
s, out = api(KEY_A, "POST", f"/v1/generations/{cid}/cancel")
s2, bal3 = api(KEY_A, "GET", "/v1/balance")
check(
    "cancel: queued one comes back, or 409 if it already started",
    (s == 200 and out["generation"]["status"] == "canceled" and bal3["balance"] == bal2["balance"]) or (s == 409 and err_code(out) == "not_cancelable"),
    f"{s} {str(out)[:120]}",
)
s, out = api(KEY_A, "POST", "/v1/generations", {"modelId": "flux-schnell", "prompt": "please [fail]"})
fg = wait_generation(KEY_A, out["generations"][0]["id"]) if s == 201 else {}
check("generate: failure reported", fg.get("status") == "failed" and fg.get("error", {}).get("message"), f"{fg.get('status')}")

# --- files ---------------------------------------------------------------------
body, h = multipart("file", "ref.png", png)
s, out = api(KEY_A, "POST", "/v1/files", body, headers=h)
UP = out.get("file", {})
check("upload: stored", s == 201 and UP.get("source") == "upload" and UP.get("kind") == "image", f"{s} {str(out)[:120]}")
body, h = multipart("file", "evil.html", b"<html><script>alert(1)</script></html>")
s, out = api(KEY_A, "POST", "/v1/files", body, headers=h)
check("upload: html refused", s == 400, f"{s}")
s, out = api(KEY_A_RO, "POST", "/v1/files", *multipart("file", "ref.png", png))
check("upload: read-only key refused", s == 403, f"{s}")
s, out = api(KEY_A, "GET", f"/v1/files/{UP.get('id')}")
check("files: record", s == 200 and out["file"]["id"] == UP.get("id"), f"{s}")
s, out = api(KEY_A, "GET", "/v1/files?source=upload")
check("files: list filtered", s == 200 and [f["id"] for f in out["files"]] == [UP.get("id")], f"{s}")

# --- privacy: member B with their own key ----------------------------------------
s, out = api(KEY_B, "GET", f"/v1/generations/{GEN}")
check("privacy: B cannot read A's generation", s == 404, f"{s}")
s, out = api(KEY_B, "POST", f"/v1/generations/{GEN}/cancel")
check("privacy: B cannot cancel A's generation", s == 404, f"{s}")
s, out = api(KEY_B, "GET", f"/v1/files/{UP.get('id')}")
check("privacy: B cannot read A's file record", s == 404, f"{s}")
s, out = api(KEY_B, "GET", f"/v1/files/{FILE.get('id')}/content")
check("privacy: B cannot read A's file bytes", s == 404, f"{s}")
s, out = api(KEY_B, "POST", "/v1/generations", {"modelId": "nano-banana-2", "prompt": "x", "inputs": {"refs": [UP.get("id")]}})
check("privacy: B cannot use A's file as input", s == 404, f"{s}")
s, out = api(KEY_B, "GET", "/v1/generations")
check("privacy: B's list is empty", s == 200 and out["generations"] == [], f"{s}")

# --- OpenAPI -------------------------------------------------------------------
s, spec = api(None, "GET", "/v1/openapi.json")
paths = spec.get("paths", {})
check("openapi: served", s == 200 and spec.get("openapi", "").startswith("3."), f"{s}")
want = [("/v1/models", "get"), ("/v1/models/{id}", "get"), ("/v1/quote", "post"), ("/v1/generations", "post"), ("/v1/generations", "get"),
        ("/v1/generations/{id}", "get"), ("/v1/generations/{id}/cancel", "post"), ("/v1/files", "post"), ("/v1/files", "get"),
        ("/v1/files/{id}", "get"), ("/v1/files/{id}/content", "get"), ("/v1/balance", "get")]
check("openapi: every route listed", all(m in paths.get(p, {}) for p, m in want), str([p for p, m in want if m not in paths.get(p, {})]))
probe_ok = True
for p, m in want:
    real = p.replace("{id}", "zz_unknown")
    st, _ = api(KEY_A, m.upper(), real, {} if m == "post" else None)
    probe_ok = probe_ok and st != 405 and not (st == 404 and "{id}" not in p)
check("openapi: every listed route answers", probe_ok)

# --- MCP -----------------------------------------------------------------------
def mcp(key, msg, headers=None):
    h = {"Accept": "application/json, text/event-stream", **(headers or {})}
    return api(key, "POST", "/mcp", msg, h, raw=True)


def mcp_json(key, msg, headers=None):
    s, h, body = mcp(key, msg, headers)
    try:
        return s, json.loads(body or b"{}")
    except ValueError:
        return s, {}


s, out = mcp_json(None, {"jsonrpc": "2.0", "id": 1, "method": "ping"})
check("mcp: no key is 401", s == 401, f"{s}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}}})
check("mcp: initialize", s == 200 and out["result"]["protocolVersion"] == "2025-06-18" and "tools" in out["result"]["capabilities"], f"{s} {str(out)[:160]}")
s, h, body = mcp(KEY_A, {"jsonrpc": "2.0", "method": "notifications/initialized"}, {"MCP-Protocol-Version": "2025-06-18"})
check("mcp: notification is 202", s == 202 and not body, f"{s}")
V = {"MCP-Protocol-Version": "2025-06-18"}
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 2, "method": "ping"}, V)
check("mcp: ping", s == 200 and out.get("result") == {}, f"{s} {out}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 3, "method": "tools/list"}, V)
names = sorted(t["name"] for t in out.get("result", {}).get("tools", []))
check("mcp: tools/list", names == sorted(["list_models", "get_model", "quote", "generate", "get_generation", "list_generations", "list_files", "get_balance"]), str(names))
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "get_balance", "arguments": {}}}, V)
r = out.get("result", {})
check("mcp: get_balance", s == 200 and r.get("isError") is False and isinstance(r.get("structuredContent", {}).get("balance"), int) and r["content"][0]["type"] == "text", f"{s} {str(out)[:160]}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 5, "method": "tools/call", "params": {"name": "get_model", "arguments": {"modelId": "flux-schnell"}}}, V)
check("mcp: get_model", out.get("result", {}).get("structuredContent", {}).get("model", {}).get("id") == "flux-schnell", f"{s}")
s, out = mcp_json(KEY_A_RO, {"jsonrpc": "2.0", "id": 6, "method": "tools/call", "params": {"name": "generate", "arguments": {"modelId": "flux-schnell", "prompt": "x"}}}, V)
check("mcp: generate needs the generate scope", out.get("result", {}).get("isError") is True, f"{s} {str(out)[:160]}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "generate", "arguments": {"modelId": "flux-schnell", "prompt": "a fox"}}}, V)
mg = out.get("result", {}).get("structuredContent", {}).get("generations", [{}])[0]
check("mcp: generate queues", mg.get("surface") == "mcp" and mg.get("status") in ("queued", "running"), f"{s} {str(out)[:200]}")
s, out = mcp_json(KEY_B, {"jsonrpc": "2.0", "id": 8, "method": "tools/call", "params": {"name": "get_generation", "arguments": {"id": GEN}}}, V)
check("mcp: B cannot read A's generation", out.get("result", {}).get("isError") is True and "not_found" in json.dumps(out), f"{s}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": {"name": "rm_rf", "arguments": {}}}, V)
check("mcp: unknown tool is -32602", out.get("error", {}).get("code") == -32602, f"{s}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 10, "method": "resources/list"}, V)
check("mcp: unknown method is -32601", out.get("error", {}).get("code") == -32601, f"{s}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 11, "method": "ping"}, {"MCP-Protocol-Version": "1999-01-01"})
check("mcp: unsupported version header is 400", s == 400 and out.get("error", {}).get("code") == -32022, f"{s}")
s, h, body = mcp(KEY_A, b"{not json", {"Content-Type": "application/json"})
check("mcp: parse error", s == 400 and json.loads(body)["error"]["code"] == -32700, f"{s}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 12, "method": "ping"}, {"Origin": "https://evil.example"})
check("mcp: cross-site origin is 403", s == 403, f"{s}")
s, out = api(KEY_A, "GET", "/mcp")
check("mcp: GET is 405", s == 405, f"{s}")
META = {"io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientInfo": {"name": "t", "version": "1"}, "io.modelcontextprotocol/clientCapabilities": {}}
M = {"MCP-Protocol-Version": "2026-07-28"}
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 13, "method": "server/discover", "params": {"_meta": META}}, {**M, "Mcp-Method": "server/discover"})
check("mcp: modern server/discover", s == 200 and "2026-07-28" in out["result"]["supportedVersions"] and out["result"]["resultType"] == "complete", f"{s} {str(out)[:160]}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 14, "method": "tools/call", "params": {"name": "list_models", "arguments": {"kind": "image"}, "_meta": META}}, {**M, "Mcp-Method": "tools/call", "Mcp-Name": "list_models"})
check("mcp: modern tools/call", s == 200 and len(out.get("result", {}).get("structuredContent", {}).get("models", [])) > 0, f"{s} {str(out)[:160]}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 15, "method": "tools/call", "params": {"name": "get_balance", "arguments": {}, "_meta": META}}, {**M, "Mcp-Method": "tools/call", "Mcp-Name": "list_models"})
check("mcp: header mismatch is 400 -32020", s == 400 and out.get("error", {}).get("code") == -32020, f"{s}")
s, out = mcp_json(KEY_A, {"jsonrpc": "2.0", "id": 16, "method": "ping", "params": {"_meta": dict(META, **{"io.modelcontextprotocol/protocolVersion": "2030-01-01"})}}, {"MCP-Protocol-Version": "2030-01-01", "Mcp-Method": "ping"})
check("mcp: unsupported modern version is 400 -32022", s == 400 and out.get("error", {}).get("code") == -32022 and out["error"]["data"]["supported"], f"{s}")

# --- usage log -----------------------------------------------------------------
s, out = a.call("GET", f"/api/developer/usage?key={KEY_A_ID}&limit=200")
reqs = out.get("requests", [])
check("usage: logs route and status", s == 200 and any(r["route"] == "/v1/generations" and r["method"] == "POST" and r["status"] == 201 and r["credits"] == cost for r in reqs), f"{s} {len(reqs)}")
check("usage: logs MCP calls", any(r["route"].startswith("/mcp tools/call") for r in reqs), "")
check("usage: 24h totals", any(t["keyId"] == KEY_A_ID and t["requests"] > 5 for t in out.get("last24h", [])), "")
s, out = b.call("GET", f"/api/developer/usage?key={KEY_A_ID}")
check("usage: B cannot read A's key log", s == 404, f"{s}")

# --- rate limit ----------------------------------------------------------------
s, out = a.call("POST", "/api/developer/keys", {"name": "Burst", "scopes": ["read"]})
burst, burst_id = out.get("secret", ""), out.get("key", {}).get("id")
limit = None
hit = None
for i in range(400):
    s, h, _ = api(burst, "GET", "/v1/balance", raw=True)
    limit = limit or int(h.get("X-RateLimit-Limit") or 0)
    if s == 429:
        hit = h
        break
check("rate limit: 429 with Retry-After", hit is not None and hit.get("Retry-After") and hit.get("X-RateLimit-Remaining") == "0", f"limit={limit}")
s, out = api(KEY_A, "GET", "/v1/balance")
check("rate limit: per key, others unaffected", s == 200, f"{s}")

# --- revoke + cap --------------------------------------------------------------
s, out = a.call("DELETE", f"/api/developer/keys/{burst_id}")
check("keys: revoked", s == 200 and out["key"]["revokedAt"], f"{s}")
s, out = api(burst, "GET", "/v1/models")
check("keys: revoked key is 401", s == 401, f"{s}")
made = 0
s = 201
while s == 201 and made < 20:
    s, out = a.call("POST", "/api/developer/keys", {"name": f"k{made}"})
    made += 1
check("keys: capped per member", s == 409 and err_code(out) == "limit_reached", f"{s} after {made}")
s, out = a.call("GET", f"/api/developer/keys/{KEY_A_ID}")
check("keys: last used recorded", s == 200 and out["key"]["lastUsedAt"], f"{s}")

# --- webhooks ------------------------------------------------------------------
for bad in ["http://example.com/hook", "https://10.0.0.1/hook", "https://localhost/hook", "https://127.0.0.1/hook", "https://[::1]/hook", "https://169.254.169.254/latest", "ftp://example.com"]:
    s, out = a.call("POST", "/api/developer/webhooks", {"url": bad})
    check(f"webhooks: refused {bad}", s == 400 and err_code(out) == "invalid_url", f"{s} {err_code(out)}")
s, out = a.call("POST", "/api/developer/webhooks", {"url": HOOK + "/x", "events": ["generation.exploded"]})
check("webhooks: unknown event refused", s == 400, f"{s}")
s, out = guest.call("POST", "/api/developer/webhooks", {"url": HOOK + "/g"})
check("webhooks: guest refused", s == 403, f"{s}")
s, out = anon.call("GET", "/api/developer/webhooks")
check("webhooks: signed out is 401", s == 401, f"{s}")

s, out = a.call("POST", "/api/developer/webhooks", {"url": HOOK + "/ok", "description": "test receiver"})
if s == 400 and err_code(out) == "invalid_url":
    check("webhooks: local URL refused without PARALLAX_ALLOW_LOCAL_WEBHOOKS", True)
    print("NOTE delivery checks skipped: start the server with PARALLAX_ALLOW_LOCAL_WEBHOOKS=1 to run them")
else:
    HOOK_ID, SECRET = out.get("webhook", {}).get("id"), out.get("secret", "")
    check("webhooks: created with secret", s == 201 and SECRET.startswith("whsec_") and out["webhook"]["events"], f"{s} {str(out)[:160]}")
    s, out = a.call("GET", "/api/developer/webhooks")
    check("webhooks: list hides the secret", s == 200 and SECRET not in json.dumps(out) and out["webhooks"][0]["secretHint"] == SECRET[-4:], f"{s}")
    s, out = b.call("GET", f"/api/developer/webhooks/{HOOK_ID}")
    check("webhooks: B cannot read A's endpoint", s == 404, f"{s}")
    s, out = b.call("POST", f"/api/developer/webhooks/{HOOK_ID}/test")
    check("webhooks: B cannot test A's endpoint", s == 404, f"{s}")

    s, out = a.call("POST", f"/api/developer/webhooks/{HOOK_ID}/test")
    d = out.get("delivery", {})
    got = wait_received(lambda i: i["headers"].get("parallax-webhook-id") == d.get("id"), 5)
    check("webhooks: test event delivered", s == 200 and d.get("status") == "delivered" and d.get("responseStatus") == 200 and got, f"{s} {str(out)[:200]}")
    check("webhooks: signature verifies", got and signature_ok(SECRET, got), "")
    check("webhooks: wrong secret does not verify", got and not signature_ok("whsec_wrong", got), "")

    s, out = api(KEY_A, "POST", "/v1/generations", {"modelId": "flux-schnell", "prompt": "for the hook"})
    hg = out["generations"][0]["id"] if s == 201 else "x"
    got = wait_received(lambda i: json.loads(i["body"]).get("data", {}).get("generation", {}).get("id") == hg, 30)
    body = json.loads(got["body"]) if got else {}
    check("webhooks: generation.succeeded delivered", body.get("type") == "generation.succeeded" and body["data"]["generation"]["files"], str(body)[:160])
    check("webhooks: event delivery signed", got and signature_ok(SECRET, got), "")
    time.sleep(2.5)
    check("webhooks: delivered once", len([i for i in received if json.loads(i["body"]).get("data", {}).get("generation", {}).get("id") == hg]) == 1, "")
    s, out = a.call("GET", f"/api/developer/webhooks/{HOOK_ID}/deliveries")
    check("webhooks: delivery log", s == 200 and any(x["generationId"] == hg and x["status"] == "delivered" for x in out.get("deliveries", [])), f"{s}")

    s, out = a.call("POST", f"/api/developer/webhooks/{HOOK_ID}/rotate")
    NEW = out.get("secret", "")
    check("webhooks: secret rotated", s == 200 and NEW.startswith("whsec_") and NEW != SECRET, f"{s}")
    s, out = a.call("PATCH", f"/api/developer/webhooks/{HOOK_ID}", {"url": HOOK + "/fail", "events": ["generation.failed"]})
    check("webhooks: updated", s == 200 and out["webhook"]["events"] == ["generation.failed"] and out["webhook"]["url"].endswith("/fail"), f"{s}")
    s, out = a.call("PATCH", f"/api/developer/webhooks/{HOOK_ID}", {"url": "https://192.168.1.1/x"})
    check("webhooks: update to a private URL refused", s == 400, f"{s}")
    s, out = a.call("POST", f"/api/developer/webhooks/{HOOK_ID}/test")
    d = out.get("delivery", {})
    check("webhooks: failing endpoint is retried later", d.get("status") == "pending" and d.get("attempts") == 1 and d.get("responseStatus") == 500 and d.get("nextAttemptAt", 0) > time.time() * 1000, str(d)[:200])
    s, out = a.call("POST", f"/api/developer/webhooks/{HOOK_ID}/deliveries/{d.get('id')}/retry")
    check("webhooks: retry of a pending delivery is 409", s == 409, f"{s}")
    s, out = a.call("DELETE", f"/api/developer/webhooks/{HOOK_ID}")
    s2, out2 = a.call("GET", f"/api/developer/webhooks/{HOOK_ID}")
    check("webhooks: deleted", s == 200 and s2 == 404, f"{s} {s2}")

failed = results.count(False)
print(f"\n{len(results) - failed}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
