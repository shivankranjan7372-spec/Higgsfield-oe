"""API test for the agent chat, in mock mode. Usage: agent.py <base-url>"""
import http.cookiejar
import json
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip("/")
results = []


def session():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


A = session()
B = session()
ANON = session()


def call(opener, method, path, body=None, headers=None, raw=False):
    data = None
    h = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
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


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def code(out):
    return out.get("error", {}).get("code")


def rows(opener, chat_id, after=0):
    _, out = call(opener, "GET", f"/api/agent/chats/{chat_id}/rows?after={after}")
    return out.get("rows", [])


def wait_for(fn, seconds=30, step=0.25):
    deadline = time.time() + seconds
    while time.time() < deadline:
        v = fn()
        if v:
            return v
        time.sleep(step)
    return None


def latest(opener, chat_id):
    """Current rows by seq (upserted), like a client would hold them."""
    by_seq = {}
    for r in rows(opener, chat_id):
        by_seq[r["seq"]] = r
    return [by_seq[k] for k in sorted(by_seq)]


def idle(opener, chat_id):
    _, out = call(opener, "GET", f"/api/agent/chats/{chat_id}")
    return out.get("chat", {}).get("state") == "idle" and all(t["status"] not in ("queued", "running", "waiting") for t in out.get("turns", []))


def cards(opener, chat_id, card=None, status=None):
    return [r for r in latest(opener, chat_id) if r["kind"] == "card" and (card is None or r["body"].get("card") == card) and (status is None or r["body"].get("status") == status)]


def send(opener, chat_id, text, **extra):
    return call(opener, "POST", f"/api/agent/chats/{chat_id}/messages", {"text": text, **extra})


def balance(opener):
    return call(opener, "GET", "/api/auth/me")[1].get("balance")


# --- signed out ---------------------------------------------------------------
s, out = call(ANON, "GET", "/api/agent/chats")
check("signed out: chats is 401", s == 401 and code(out) == "unauthorized", f"{s}")
s, out = call(ANON, "GET", "/api/agent/events", raw=True)[:2]
check("signed out: event stream is 401", s == 401, f"{s}")
s, out = call(ANON, "GET", "/api/agent/showcase")
check("signed out: showcase works", s == 200 and len(out.get("items", [])) >= 4, f"{s}")

s, g = call(A, "POST", "/api/auth/guest")
check("member A: guest account", s == 200 and g["user"]["isGuest"], f"{s}")
s, _ = call(B, "POST", "/api/auth/guest")
check("member B: guest account", s == 200, f"{s}")

s, out = call(A, "POST", "/api/agent/chats", {"title": "x"}, headers={"Origin": "https://evil.example"})
check("cross-site write refused", s == 403, f"{s}")

s, cfg = call(A, "GET", "/api/agent/config")
check("config: modes and models", s == 200 and {m["id"] for m in cfg["modes"]} == {"ask", "auto"} and any(m["id"] == "auto" for m in cfg["models"]), f"{s}")
check("config: every service is a mock here", cfg.get("services") == {"llm": "mock", "computer": "mock", "connectors": "mock"}, str(cfg.get("services")))
check("config: the built-in engine is in charge", cfg.get("engine") == {"id": "builtin", "name": "Built-in"}, str(cfg.get("engine")))
s, out = call(A, "POST", "/api/agent/mcp", {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, headers={"Authorization": "Bearer " + "x" * 32})
check("engine tools: the address does not exist on the built-in engine", s == 404, f"{s}")

# --- event stream -------------------------------------------------------------
events = []


def listen():
    req = urllib.request.Request(BASE + "/api/agent/events")
    try:
        with A.open(req, timeout=120) as res:
            name = None
            for line in res:
                line = line.decode("utf8").rstrip("\n")
                if line.startswith("event: "):
                    name = line[7:]
                elif line.startswith("data: ") and name:
                    events.append((name, json.loads(line[6:])))
                    name = None
    except Exception:
        pass


threading.Thread(target=listen, daemon=True).start()
check("events: stream opens with ready", wait_for(lambda: any(e[0] == "ready" for e in events), 10), f"{len(events)} events")

# --- chats --------------------------------------------------------------------
s, out = call(A, "POST", "/api/agent/chats", {"title": "y" * 200})
check("chat: long title refused", s == 400 and code(out) == "invalid_request", f"{s}")
s, out = call(A, "POST", "/api/agent/chats", {"incognito": "yes"})
check("chat: bad incognito refused", s == 400, f"{s}")
s, out = call(A, "POST", "/api/agent/chats", {})
chat = out.get("chat", {})
cid = chat.get("id")
check("chat: created", s == 200 and cid and chat["state"] == "idle", f"{s} {str(out)[:120]}")

# --- plain reply streams --------------------------------------------------------
s, out = send(A, cid, "hello there")
check("message: queued a turn", s == 200 and out.get("turn", {}).get("status") in ("queued", "running") and out["row"]["kind"] == "message", f"{s} {str(out)[:160]}")
wait_for(lambda: idle(A, cid), 20)
rs = latest(A, cid)
reply = [r for r in rs if r["kind"] == "message" and r["body"].get("role") == "assistant"]
check("message: assistant replied", reply and "hello there" in reply[-1]["body"]["text"] and reply[-1]["body"]["streaming"] is False, str([r["body"] for r in reply])[:200])
check("message: streaming rewrote the row (updatedSeq > first write)", reply and reply[-1]["updatedSeq"] > reply[-1]["seq"], str(reply[-1] if reply else None)[:160])
row_events = [e for e in events if e[0] == "row" and e[1]["chatId"] == cid]
streamed = [e for e in row_events if e[1]["kind"] == "message" and e[1]["body"].get("role") == "assistant"]
check("events: rows arrive on the stream", len(row_events) >= 2 and len(streamed) >= 2, f"{len(row_events)} row events, {len(streamed)} assistant writes")
s, ch = call(A, "GET", "/api/agent/chats")
check("chat: titled from first message and listed", any(c["id"] == cid and c["title"].startswith("hello there") for c in ch.get("chats", [])), str(ch)[:160])
rev = rs[-1]["updatedSeq"] if rs else 0
check("rows: after=rev returns nothing new", rows(A, cid, rev) == [], "")
s, out = send(A, cid, "")
check("message: empty refused", s == 400, f"{s}")
s, out = send(A, cid, "hi", mode="yolo")
check("message: bad mode refused", s == 400, f"{s}")
s, out = send(A, cid, "hi", fileIds=["ast_nothere"])
check("message: unknown file is 404", s == 404, f"{s}")

# --- generate_media, ask before generating --------------------------------------------
start_balance = balance(A)
_, jobs_before = call(A, "GET", "/api/jobs")
send(A, cid, "generate an image of a red fox in snow")
card = wait_for(lambda: cards(A, cid, "approval", "pending"), 20)
check("generate(ask): approval card shown", bool(card), "")
if card:
    body = card[0]["body"]
    check("generate(ask): card has model, prompt and price", body.get("modelId") and "red fox" in body.get("prompt", "") and body.get("price", 0) > 0, str(body)[:200])
    _, jobs_mid = call(A, "GET", "/api/jobs")
    check("generate(ask): nothing spent while waiting", balance(A) == start_balance and len(jobs_mid["jobs"]) == len(jobs_before["jobs"]), "")
    s, out = call(A, "POST", f"/api/agent/approvals/{body['approvalId']}", {"decision": "always"})
    check("generate(ask): 'always' is not offered for credits", s == 400, f"{s}")
    s, out = call(B, "POST", f"/api/agent/approvals/{body['approvalId']}", {"decision": "allow"})
    check("privacy: B cannot answer A's card", s == 404, f"{s}")
    s, out = call(A, "POST", f"/api/agent/approvals/{body['approvalId']}", {"decision": "deny"})
    check("generate(ask): deny accepted", s == 200 and out.get("status") == "denied", f"{s} {out}")
    s, out = call(A, "POST", f"/api/agent/approvals/{body['approvalId']}", {"decision": "allow"})
    check("generate(ask): second answer is 409", s == 409, f"{s}")
    wait_for(lambda: idle(A, cid), 20)
    _, jobs_after = call(A, "GET", "/api/jobs")
    check("generate(ask): denied means no job and no spend", balance(A) == start_balance and len(jobs_after["jobs"]) == len(jobs_before["jobs"]), "")

send(A, cid, "generate an image of a blue heron")
card = wait_for(lambda: cards(A, cid, "approval", "pending"), 20)
price = card[0]["body"]["price"] if card else 0
if card:
    s, out = call(A, "POST", f"/api/agent/approvals/{card[0]['body']['approvalId']}", {"decision": "allow"})
    check("generate(ask): allow accepted", s == 200, f"{s}")
res = wait_for(lambda: [c for c in cards(A, cid, "result") if c["body"]["status"] == "succeeded"], 60)
check("generate(ask): result card with file ids", res and len(res[0]["body"]["assetIds"]) >= 1 and res[0]["body"]["files"][0]["url"].startswith("/api/assets/"), str(res[0]["body"] if res else None)[:200])
wait_for(lambda: idle(A, cid), 20)
check("generate(ask): charged exactly the shown price", balance(A) == start_balance - price and price > 0, f"{start_balance} -> {balance(A)} price={price}")
if res:
    s, j = call(A, "GET", f"/api/jobs/{res[0]['body']['jobIds'][0]}")
    check("generate: job carries the chat in meta", j.get("job", {}).get("surface") == "super" and j["job"]["meta"].get("superChatId") == cid, str(j.get("job", {}).get("meta")))

# --- generate without asking ------------------------------------------------------
before = balance(A)
send(A, cid, "generate an image of a paper boat", mode="auto")
res2 = wait_for(lambda: [c for c in cards(A, cid, "result") if "paper boat" in c["body"].get("prompt", "") and c["body"]["status"] == "succeeded"], 60)
check("generate(auto): runs with no approval card", res2 and not cards(A, cid, "approval", "pending"), "")
wait_for(lambda: idle(A, cid), 20)
check("generate(auto): credits spent", balance(A) < before, f"{before} -> {balance(A)}")

# --- computer ------------------------------------------------------------------
s, comp = call(A, "GET", "/api/agent/computer")
check("computer: none before first use", comp.get("computer", {}).get("status") == "none", str(comp))
send(A, cid, "look up tide tables on the web")
wait_for(lambda: idle(A, cid), 20)
tc = [r for r in latest(A, cid) if r["kind"] == "tool-call" and r["body"]["tool"] == "computer_open_page"]
check("computer: open page tool ran", tc and tc[-1]["body"]["status"] == "done", str(tc[-1]["body"] if tc else None)[:200])
s, comp = call(A, "GET", "/api/agent/computer")
check("computer: created and running", comp["computer"]["status"] == "running" and comp["computer"]["screenshotUrl"], str(comp))
s, hdrs, png = call(A, "GET", "/api/agent/computer/screenshot", raw=True)
check("computer: screenshot is a PNG", s == 200 and png[:4] == b"\x89PNG" and hdrs.get("Content-Type") == "image/png", f"{s} {len(png)}")
s, _, _ = call(B, "GET", "/api/agent/computer/screenshot", raw=True)
check("privacy: B has no screenshot of A's computer", s == 404, f"{s}")

# --- connectors ------------------------------------------------------------------
s, conn = call(A, "GET", "/api/agent/connectors")
check("connectors: catalog of six apps", s == 200 and len(conn["apps"]) == 6 and all(a["status"] == "none" for a in conn["apps"]), f"{s} {len(conn.get('apps', []))}")
send(A, cid, "email sam@example.com see you at noon")
wait_for(lambda: idle(A, cid), 20)
cc = cards(A, cid, "connect")
check("connectors: asks to connect mail with a link", cc and cc[-1]["body"]["app"] == "mail" and cc[-1]["body"]["url"], str(cc[-1]["body"] if cc else None)[:200])
s, out = call(A, "POST", "/api/agent/connectors/apps/nope/connect")
check("connectors: unknown app is 404", s == 404, f"{s}")
s, out = call(A, "GET", "/api/agent/connectors")
check("connectors: mail connected", any(a["slug"] == "mail" and a["status"] == "active" for a in out["apps"]), "")
s, out = call(B, "GET", "/api/agent/connectors")
check("privacy: B does not see A's connection", all(a["status"] == "none" for a in out["apps"]), "")

send(A, cid, "check my mail")
wait_for(lambda: idle(A, cid), 20)
tc = [r for r in latest(A, cid) if r["kind"] == "tool-call" and r["body"]["tool"] == "app_MAIL_LIST_MESSAGES"]
check("connectors: read-only tool runs without approval", tc and tc[-1]["body"]["status"] == "done", str(tc[-1]["body"] if tc else None))
last_reply = [r for r in latest(A, cid) if r["kind"] == "message" and r["body"]["role"] == "assistant"][-1]["body"]["text"]
check("safety: app output reaches the model wrapped as data", '<untrusted-data source="app:mail">' in last_reply, last_reply[:160])

send(A, cid, "email sam@example.com see you at noon")
card = wait_for(lambda: cards(A, cid, "approval", "pending"), 20)
check("connectors: sending needs approval with allow/always/deny", card and card[0]["body"]["choices"] == ["allow", "always", "deny"], str(card[0]["body"] if card else None)[:200])
if card:
    s, out = call(A, "POST", f"/api/agent/approvals/{card[0]['body']['approvalId']}", {"decision": "always"})
    check("connectors: always allow accepted", s == 200, f"{s} {out}")
wait_for(lambda: idle(A, cid), 20)
send(A, cid, "email kim@example.com hello")
wait_for(lambda: idle(A, cid), 20)
sends = [r for r in latest(A, cid) if r["kind"] == "tool-call" and r["body"]["tool"] == "app_MAIL_SEND_EMAIL"]
check("connectors: always-allowed tool runs without a new card", len(sends) == 2 and sends[-1]["body"]["status"] == "done" and not cards(A, cid, "approval", "pending"), str([r["body"] for r in sends])[:200])

s, out = call(A, "POST", "/api/agent/connectors/mcp", {"name": "My tools", "url": "http://insecure.example/mcp"})
check("mcp: plain http refused", s == 400, f"{s}")
s, out = call(A, "POST", "/api/agent/connectors/mcp", {"name": "My tools", "url": "https://tools.example/mcp"})
mcp_id = out.get("server", {}).get("id")
check("mcp: stored", s == 200 and mcp_id, f"{s} {out}")
s, out = call(B, "DELETE", f"/api/agent/connectors/mcp/{mcp_id}")
check("privacy: B cannot delete A's server", s == 404, f"{s}")
s, out = call(A, "DELETE", f"/api/agent/connectors/mcp/{mcp_id}")
check("mcp: deleted", s == 200, f"{s}")
s, out = call(A, "POST", "/api/agent/connectors/apps/mail/disconnect")
check("connectors: disconnect", s == 200, f"{s}")

# --- memory, questions ------------------------------------------------------------
send(A, cid, "remember that I like teal")
wait_for(lambda: idle(A, cid), 20)
s, mem = call(A, "GET", "/api/agent/memory")
m = [x for x in mem.get("memories", []) if "teal" in x["text"]]
check("memory: remembered", s == 200 and m, str(mem)[:160])
s, out = call(B, "GET", "/api/agent/memory")
check("privacy: B's memory is empty", out.get("memories") == [], str(out)[:80])
if m:
    s, _ = call(B, "DELETE", f"/api/agent/memory/{m[0]['id']}")
    check("privacy: B cannot delete A's memory", s == 404, f"{s}")
    s, _ = call(A, "DELETE", f"/api/agent/memory/{m[0]['id']}")
    check("memory: deleted", s == 200 and call(A, "GET", "/api/agent/memory")[1]["memories"] == [], f"{s}")

send(A, cid, "ask me whether blue works")
q = wait_for(lambda: cards(A, cid, "question", "pending"), 20)
check("ask_user: question card with choices", q and q[0]["body"]["choices"] == ["Yes", "No"], str(q[0]["body"] if q else None)[:160])
if q:
    s, out = call(A, "POST", f"/api/agent/approvals/{q[0]['body']['approvalId']}", {"choice": "Yes"})
    check("ask_user: answered", s == 200 and out["status"] == "answered", f"{s} {out}")
wait_for(lambda: idle(A, cid), 20)

# --- a new message expires a waiting card -------------------------------------------
send(A, cid, "generate an image of a lantern")
card = wait_for(lambda: cards(A, cid, "approval", "pending"), 20)
send(A, cid, "never mind")
wait_for(lambda: idle(A, cid), 20)
check("approval: a new message expires the waiting card", card and any(c["seq"] == card[0]["seq"] and c["body"]["status"] == "expired" for c in cards(A, cid)), "")

# --- stop and failure -----------------------------------------------------------------
send(A, cid, "[slow] take your time")
time.sleep(0.8)
s, out = call(A, "POST", f"/api/agent/chats/{cid}/stop")
check("stop: accepted", s == 200 and out.get("stopped") is True, f"{s} {out}")
wait_for(lambda: idle(A, cid), 20)
notices = [r["body"] for r in latest(A, cid) if r["kind"] == "notice"]
check("stop: a notice says stopped", any(n.get("code") == "stopped" for n in notices), str(notices)[:200])
send(A, cid, "[llm-fail] please")
wait_for(lambda: idle(A, cid), 20)
notices = [r["body"] for r in latest(A, cid) if r["kind"] == "notice"]
check("failure: a failed turn posts a notice", any(n.get("code") == "turn_failed" and n.get("level") == "error" for n in notices), str(notices)[:200])
s, out = send(A, cid, "hello again")
wait_for(lambda: idle(A, cid), 20)
check("failure: the chat keeps working afterwards", latest(A, cid)[-1]["body"].get("role") == "assistant", "")

# --- privacy on chats ----------------------------------------------------------------
s, _ = call(B, "GET", f"/api/agent/chats/{cid}")
check("privacy: B cannot read A's chat", s == 404, f"{s}")
s, _ = call(B, "GET", f"/api/agent/chats/{cid}/rows")
check("privacy: B cannot read A's rows", s == 404, f"{s}")
s, _ = send(B, cid, "hi")
check("privacy: B cannot post to A's chat", s == 404, f"{s}")
s, _ = call(B, "POST", f"/api/agent/chats/{cid}/stop")
check("privacy: B cannot stop A's chat", s == 404, f"{s}")
s, _ = call(B, "DELETE", f"/api/agent/chats/{cid}")
check("privacy: B cannot delete A's chat", s == 404, f"{s}")
s, out = call(B, "GET", "/api/agent/chats")
check("privacy: B's chat list is empty", out.get("chats") == [], str(out)[:80])

# --- rename and pin ------------------------------------------------------------------
_, other = call(A, "POST", "/api/agent/chats", {"title": "Second"})
s, out = call(A, "PATCH", f"/api/agent/chats/{cid}", {"title": "Renamed", "pinned": True})
check("chat: rename and pin", s == 200 and out["chat"]["title"] == "Renamed" and out["chat"]["pinned"], f"{s}")
s, out = call(A, "GET", "/api/agent/chats")
check("chat: pinned chat listed first", out["chats"][0]["id"] == cid, str([c["title"] for c in out["chats"]]))
s, out = call(A, "PATCH", f"/api/agent/chats/{cid}", {"pinned": "yes"})
check("chat: bad pinned refused", s == 400, f"{s}")

# --- projects ------------------------------------------------------------------------
s, out = call(A, "POST", "/api/agent/projects", {"name": "Spring launch", "instructions": "Pastel colours only.", "fileIds": ["ast_nope"]})
check("project: unknown file is 404", s == 404, f"{s}")
file_id = res[0]["body"]["assetIds"][0] if res else None
s, out = call(A, "POST", "/api/agent/projects", {"name": "Spring launch", "instructions": "Pastel colours only.", "fileIds": [file_id] if file_id else []})
pid = out.get("project", {}).get("id")
check("project: created", s == 200 and pid and out["project"]["instructions"] == "Pastel colours only.", f"{s} {str(out)[:120]}")
s, out = call(A, "POST", "/api/agent/projects", {"name": ""})
check("project: name required", s == 400, f"{s}")
s, out = call(A, "POST", "/api/agent/chats", {"projectId": pid})
pchat = out.get("chat", {}).get("id")
s, out = call(A, "GET", f"/api/agent/projects/{pid}")
check("project: lists its chats", s == 200 and any(c["id"] == pchat for c in out["chats"]) and out["project"]["chatCount"] == 1, f"{s}")
s, out = call(A, "PATCH", f"/api/agent/projects/{pid}", {"instructions": "Bold colours."})
check("project: updated", s == 200 and out["project"]["instructions"] == "Bold colours.", f"{s}")
s, _ = call(B, "GET", f"/api/agent/projects/{pid}")
check("privacy: B cannot read A's project", s == 404, f"{s}")
s, _ = call(B, "POST", "/api/agent/chats", {"projectId": pid})
check("privacy: B cannot start a chat in A's project", s == 404, f"{s}")

# --- skills --------------------------------------------------------------------------
s, out = call(A, "GET", "/api/agent/skills")
builtins = [k for k in out.get("skills", []) if k["builtIn"]]
check("skills: built-ins listed", s == 200 and len(builtins) >= 6, f"{s} {len(builtins)}")
s, out = call(A, "POST", "/api/agent/skills", {"name": "Tone", "instructions": "Write warmly."})
sid = out.get("skill", {}).get("id")
check("skills: custom created", s == 200 and sid and not out["skill"]["builtIn"], f"{s}")
s, out = call(A, "POST", "/api/agent/skills", {"name": "No body"})
check("skills: instructions required", s == 400, f"{s}")
s, out = call(A, "PATCH", f"/api/agent/chats/{cid}", {"skillIds": [sid, builtins[0]["id"]]})
check("skills: attached to a chat", s == 200 and out["chat"]["skillIds"] == [sid, builtins[0]["id"]], f"{s}")
s, out = call(A, "PATCH", f"/api/agent/chats/{cid}", {"skillIds": ["skl_nope"]})
check("skills: unknown skill is 404", s == 404, f"{s}")
s, out = call(A, "PATCH", f"/api/agent/skills/{builtins[0]['id']}", {"name": "Mine now"})
check("skills: built-in cannot be changed", s == 404, f"{s}")
s, _ = call(B, "PATCH", f"/api/agent/chats/{other['chat']['id']}", {"skillIds": [sid]})
check("privacy: B cannot touch A's chat or skill", s == 404, f"{s}")
s, _ = call(B, "DELETE", f"/api/agent/skills/{sid}")
check("privacy: B cannot delete A's skill", s == 404, f"{s}")
s, _ = call(A, "DELETE", f"/api/agent/projects/{pid}")
check("project: deleted, chat stays", s == 200 and call(A, "GET", f"/api/agent/chats/{pchat}")[0] == 200, f"{s}")

# --- incognito -----------------------------------------------------------------------
s, out = call(A, "POST", "/api/agent/chats", {"incognito": True})
icid = out.get("chat", {}).get("id")
check("incognito: created", s == 200 and out["chat"]["incognito"], f"{s}")
send(A, icid, "remember that my secret is plum")
wait_for(lambda: idle(A, icid), 20)
s, mem = call(A, "GET", "/api/agent/memory")
check("incognito: nothing saved to memory", not any("plum" in x["text"] for x in mem["memories"]), str(mem)[:160])
s, out = call(A, "POST", f"/api/agent/chats/{icid}/close")
check("incognito: closing deletes it", s == 200 and out.get("deleted") is True, f"{s} {out}")
s, out = call(A, "GET", "/api/agent/chats")
check("incognito: gone from the list", all(c["id"] != icid for c in out["chats"]), "")
s, out = call(A, "POST", f"/api/agent/chats/{cid}/close")
check("close: a normal chat stays", s == 200 and out.get("deleted") is False, f"{s}")

# --- schedules -----------------------------------------------------------------------
s, out = call(A, "POST", "/api/agent/schedules", {"title": "Daily moon", "prompt": "generate an image of the moon", "intervalMinutes": 5})
check("schedule: too-short interval refused", s == 400, f"{s}")
s, out = call(A, "POST", "/api/agent/schedules", {"title": "Daily moon", "prompt": "generate an image of the moon", "intervalMinutes": 1440, "runNow": True})
sch = out.get("schedule", {})
check("schedule: created", s == 200 and sch.get("id") and sch["enabled"], f"{s} {str(out)[:120]}")
s, _ = call(B, "PATCH", f"/api/agent/schedules/{sch.get('id')}", {"enabled": False})
check("privacy: B cannot change A's schedule", s == 404, f"{s}")
bal = balance(A)


def scheduled_chat():
    _, o = call(A, "GET", "/api/agent/schedules")
    return o["schedules"][0]["chatId"] if o.get("schedules") and o["schedules"][0]["chatId"] else None


sc = wait_for(scheduled_chat, 50, 1)
check("schedule: due run made its own chat", sc, "")
if sc:
    pend = wait_for(lambda: cards(A, sc, "approval", "pending"), 20)
    check("schedule: run asks before spending", pend and balance(A) == bal, f"balance {bal} -> {balance(A)}")
    call(A, "POST", f"/api/agent/chats/{sc}/stop")
s, out = call(A, "PATCH", f"/api/agent/schedules/{sch.get('id')}", {"enabled": False})
check("schedule: paused", s == 200 and out["schedule"]["enabled"] is False, f"{s}")
s, out = call(A, "DELETE", f"/api/agent/schedules/{sch.get('id')}")
check("schedule: deleted", s == 200, f"{s}")

# --- delete --------------------------------------------------------------------------
s, _ = call(A, "DELETE", f"/api/agent/chats/{other['chat']['id']}")
check("chat: deleted", s == 200 and call(A, "GET", f"/api/agent/chats/{other['chat']['id']}")[0] == 404, f"{s}")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
