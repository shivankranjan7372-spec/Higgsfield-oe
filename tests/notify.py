"""Notifications, live updates and search, in mock mode. Usage: notify.py <base-url>"""
import http.cookiejar
import json
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip("/")
results = []


class Client:
    """One browser: its own cookie jar."""

    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method, path, body=None, headers=None):
        h = dict(headers or {})
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
        try:
            with self.opener.open(req, timeout=60) as res:
                payload, status = res.read(), res.status
        except urllib.error.HTTPError as err:
            payload, status = err.read(), err.code
        try:
            return status, json.loads(payload or b"{}")
        except ValueError:
            return status, {"_text": payload[:200].decode("utf8", "replace")}

    def stream(self, path, seconds):
        """Reads an event stream for up to `seconds`. Returns (status, content type, lines, closed_by_server)."""
        req = urllib.request.Request(BASE + path, headers={"Accept": "text/event-stream"})
        lines, closed = [], False
        try:
            res = self.opener.open(req, timeout=seconds + 5)
        except urllib.error.HTTPError as err:
            return err.code, err.headers.get("Content-Type"), [], True
        deadline = time.time() + seconds
        with res:
            while time.time() < deadline:
                line = res.readline()
                if not line:
                    closed = True
                    break
                lines.append(line.decode("utf8").rstrip("\n"))
        return res.status, res.headers.get("Content-Type"), lines, closed

    def wait_jobs(self, ids, seconds=60):
        deadline = time.time() + seconds
        jobs = {}
        while time.time() < deadline:
            for i in ids:
                _, out = self.call("GET", f"/api/jobs/{i}")
                jobs[i] = out.get("job", {})
            if all(j.get("status") in ("succeeded", "failed", "canceled") for j in jobs.values()):
                break
            time.sleep(0.5)
        return [jobs[i] for i in ids]


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def code(out):
    return out.get("error", {}).get("code")


def events(lines):
    """[(event, data)] from raw SSE lines."""
    out, name = [], None
    for line in lines:
        if line.startswith("event: "):
            name = line[7:]
        elif line.startswith("data: ") and name:
            out.append((name, json.loads(line[6:])))
            name = None
    return out


anon = Client()
a = Client()
b = Client()

# --- signed out ---------------------------------------------------------------
for path in ["/api/notifications", "/api/notifications/unread", "/api/notifications/preferences", "/api/search/recent"]:
    s, out = anon.call("GET", path)
    check(f"signed out: GET {path} is 401", s == 401 and code(out) == "unauthorized", f"{s}")
st, ctype, lines, _ = anon.stream("/api/notifications/stream", 3)
check("signed out: stream is 401", st == 401, f"{st}")
s, out = anon.call("GET", "/api/search?q=flux")
types = [g["type"] for g in out.get("groups", [])]
check("signed out: search finds models", s == 200 and types == ["models", "posts"] and out["groups"][0]["items"], f"{s} {types}")
check("signed out: search reports engine", out.get("engine") in ("fts5", "like"), out.get("engine"))
s, out = anon.call("GET", "/api/search?q=flux&types=files,folders")
check("signed out: member-only groups are skipped", s == 200 and out.get("groups") == [], f"{s} {out}")
s, out = anon.call("GET", "/api/search/commands")
ids = [c["id"] for c in out.get("commands", [])]
check("signed out: commands offer sign-in, not sign-out", s == 200 and "sign-in" in ids and "sign-out" not in ids, str(ids)[:200])
s, out = anon.call("GET", "/api/notifications/whats-new")
check("signed out: what's new, all unseen", s == 200 and out["unseen"] == len(out["items"]) > 0, f"{s} {out.get('unseen')}")
s, out = anon.call("GET", "/api/search/suggestions")
check("signed out: suggestions have popular models only", s == 200 and out["popularModels"] and out["recentItems"] == [] and out["recentSearches"] == [], f"{s}")
s, out = anon.call("POST", "/api/notifications/read", {"all": True})
check("signed out: mark read is 401", s == 401, f"{s}")

# --- bad input ---------------------------------------------------------------
s, out = anon.call("GET", "/api/search?q=")
check("search: empty query is 400", s == 400 and code(out) == "invalid_request", f"{s}")
s, out = anon.call("GET", "/api/search?q=" + "x" * 101)
check("search: long query is 400", s == 400, f"{s}")
s, out = anon.call("GET", "/api/search?q=flux&types=models,bogus")
check("search: unknown type is 400", s == 400, f"{s} {out}")

s, g = a.call("POST", "/api/auth/guest")
check("member A signed in", s == 200, f"{s}")
s, gb = b.call("POST", "/api/auth/guest")
check("member B signed in", s == 200, f"{s}")

s, out = a.call("PUT", "/api/notifications/preferences", {"kinds": {"nope": False}})
check("prefs: unknown kind is 400", s == 400, f"{s}")
s, out = a.call("PUT", "/api/notifications/preferences", {"kinds": {"like": "off"}})
check("prefs: non-boolean is 400", s == 400, f"{s}")
s, out = a.call("PUT", "/api/notifications/preferences", {"kinds": {"system": False}})
check("prefs: system cannot be muted", s == 400, f"{s} {out}")
s, out = a.call("PUT", "/api/notifications/preferences", [1])
check("prefs: non-object body is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/notifications/read", {"ids": "x"})
check("read: bad body is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/search/recent", {"query": "   "})
check("recent: blank query is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/search/recent", {"query": 5})
check("recent: non-text query is 400", s == 400, f"{s}")
s, out = a.call("PATCH", "/api/notifications/ntc_missing", {"read": True})
check("notice: unknown id is 404", s == 404 and code(out) == "not_found", f"{s}")
s, out = a.call("POST", "/api/notifications/read", {"all": True}, headers={"Origin": "https://evil.example"})
check("cross-site write refused", s == 403, f"{s}")

# --- job notices, exactly once ----------------------------------------------
s, out = a.call("GET", "/api/notifications")
check("empty inbox", s == 200 and out["notices"] == [] and out["unread"] == 0 and out["nextCursor"] is None, f"{s} {out}")
s, ok_out = a.call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a lighthouse on a cliff at dusk"})
s2, bad_out = a.call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "storm clouds [fail]"})
job_ok, job_bad = ok_out["jobs"][0], bad_out["jobs"][0]
done = a.wait_jobs([job_ok["id"], job_bad["id"]])
check("jobs finished", [j["status"] for j in done] == ["succeeded", "failed"], str([j.get("status") for j in done]))
s, out = a.call("GET", "/api/notifications")
kinds = sorted(n["kind"] for n in out.get("notices", []))
check("generation done + failed notices", kinds == ["generation_done", "generation_failed"], str(kinds))
done_notice = next((n for n in out["notices"] if n["kind"] == "generation_done"), {})
check("done notice links to the job", done_notice.get("data", {}).get("jobId") == job_ok["id"] and done_notice.get("link", "").startswith("/library"), str(done_notice)[:200])
check("unread count is 2", out.get("unread") == 2, str(out.get("unread")))
for _ in range(3):
    a.call("GET", "/api/notifications")
s, out = a.call("GET", "/api/notifications")
check("notices are made exactly once", len(out["notices"]) == 2, f"{len(out['notices'])}")

# --- paging, filters, read state, delete ------------------------------------
s, p1 = a.call("GET", "/api/notifications?limit=1")
s2, p2 = a.call("GET", f"/api/notifications?limit=1&before={p1.get('nextCursor')}")
check("paging", p1.get("nextCursor") and len(p2.get("notices", [])) == 1 and p2["notices"][0]["id"] != p1["notices"][0]["id"] and p2["nextCursor"] is None, f"{p1.get('nextCursor')}")
s, out = a.call("GET", "/api/notifications?kind=generation_failed")
check("kind filter", s == 200 and [n["kind"] for n in out["notices"]] == ["generation_failed"], f"{s}")
s, out = a.call("GET", "/api/notifications?kind=bogus")
check("kind filter: unknown is 400", s == 400, f"{s}")
nid = done_notice["id"]
s, out = a.call("PATCH", f"/api/notifications/{nid}", {"read": True})
check("mark one read", s == 200 and out["notice"]["read"] and out["unread"] == 1, f"{s} {out.get('unread')}")
s, out = a.call("GET", "/api/notifications?unread=1")
check("unread filter", [n["kind"] for n in out["notices"]] == ["generation_failed"], str([n["kind"] for n in out.get("notices", [])]))
s, out = a.call("PATCH", f"/api/notifications/{nid}", {"read": "yes"})
check("mark read: bad value is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/notifications/read", {"all": True})
check("mark all read", s == 200 and out["changed"] == 1 and out["unread"] == 0, str(out))
s, out = a.call("GET", "/api/notifications/unread")
check("unread count endpoint", s == 200 and out == {"unread": 0}, str(out))

# --- another member cannot reach A's notices ----------------------------------
s, out = b.call("GET", "/api/notifications")
check("B sees none of A's notices", s == 200 and out["notices"] == [], str(out)[:120])
s, out = b.call("PATCH", f"/api/notifications/{nid}", {"read": False})
check("B cannot change A's notice (404)", s == 404, f"{s}")
s, out = b.call("DELETE", f"/api/notifications/{nid}")
check("B cannot delete A's notice (404)", s == 404, f"{s}")
s, out = b.call("POST", "/api/notifications/read", {"ids": [nid]})
check("B's mark-read skips A's ids", s == 200 and out["changed"] == 0, str(out))
s, out = a.call("PATCH", f"/api/notifications/{nid}", {"read": False})
check("A's notice untouched by B, then marked unread", s == 200 and out["unread"] == 1, str(out.get("unread")))

s, out = a.call("DELETE", f"/api/notifications/{nid}")
check("delete a notice", s == 200 and out["unread"] == 0, str(out))
s, out = a.call("GET", "/api/notifications")
check("deleted notice is gone and not re-created", nid not in [n["id"] for n in out["notices"]] and len(out["notices"]) == 1, str(len(out["notices"])))

# --- preferences ------------------------------------------------------------
s, out = a.call("GET", "/api/notifications/preferences")
prefs = {p["kind"]: p for p in out.get("preferences", [])}
check("prefs: all kinds listed and on", s == 200 and len(prefs) >= 8 and all(p["enabled"] for p in prefs.values()), f"{s} {len(prefs)}")
s, out = a.call("PUT", "/api/notifications/preferences", {"kinds": {"generation_done": False}})
check("prefs: mute generation_done", s == 200 and not {p["kind"]: p for p in out["preferences"]}["generation_done"]["enabled"], f"{s}")
s, out = a.call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "muted result"})
muted_id = out["jobs"][0]["id"]
a.wait_jobs([muted_id])
s, out = a.call("GET", "/api/notifications")
check("prefs: muted kind makes no notice", s == 200 and all(n["data"].get("jobId") != muted_id for n in out["notices"]), str([n["body"] for n in out["notices"]]))
a.call("PUT", "/api/notifications/preferences", {"kinds": {"generation_done": True}})

# --- credits low ------------------------------------------------------------
s, me = a.call("GET", "/api/auth/me")
bal = me["balance"]
spent = 0
for _ in range(40):
    if bal < 20000:
        break
    s, out = a.call("POST", "/api/jobs", {"modelId": "seedance-1-lite", "prompt": "spend", "count": 1})
    if s != 200:
        s, out = a.call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "spend", "count": 4})
    if s != 200:
        break
    a.wait_jobs([j["id"] for j in out["jobs"]])
    bal = out["balance"]
check("balance brought under 20 credits", bal < 20000, f"balance={bal}")
s, out = a.call("GET", "/api/notifications?kind=credits_low")
check("credits low notice", s == 200 and len(out["notices"]) >= 1 and out["notices"][0]["link"] == "/wallet", str([n["title"] for n in out.get("notices", [])]))
n_low = len(out["notices"])
a.call("GET", "/api/notifications")
s, out = a.call("GET", "/api/notifications?kind=credits_low")
check("credits low is not repeated", len(out["notices"]) == n_low, f"{len(out['notices'])} vs {n_low}")

# --- live stream ------------------------------------------------------------
st, ctype, lines, closed = a.stream("/api/notifications/stream?heartbeat=1&timeout=3", 8)
ev = events(lines)
check("stream: event-stream content type", st == 200 and (ctype or "").startswith("text/event-stream"), f"{st} {ctype}")
check("stream: ready event with unread", ev and ev[0][0] == "ready" and "unread" in ev[0][1], str(ev[:2]))
check("stream: heartbeat", any(l.startswith(": ping") for l in lines), str(lines[:6]))
check("stream: says bye and closes cleanly", closed and ev[-1][0] == "bye", f"closed={closed} last={ev[-1] if ev else None}")

box = {}
t = threading.Thread(target=lambda: box.update(r=a.stream("/api/notifications/stream?heartbeat=5&timeout=15", 20)))
t.start()
time.sleep(1.5)
a.call("POST", "/api/notifications/read", {"all": True})
s, out = a.call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a live ping test"})
t.join()
ev = events(box["r"][2])
names = [e[0] for e in ev]
check("stream: unread event after mark-all-read", "unread" in names, str(names))
live = [e[1]["notice"] for e in ev if e[0] == "notice"]
check("stream: notice pushed when a job finishes", any(n["data"].get("jobId") == out["jobs"][0]["id"] for n in live), str(names))

# --- search -----------------------------------------------------------------
s, lib = a.call("GET", "/api/assets?kind=image&limit=100")
mine = lib.get("assets", [])
check("A has images to search", len(mine) >= 3, str(len(mine)))
older, newer = mine[-1]["id"], mine[-2]["id"]
a.call("PATCH", f"/api/assets/{older}", {"title": "Lighthouse study"})
a.call("PATCH", f"/api/assets/{newer}", {"title": "Old lighthouse keeper"})
s, out = a.call("GET", "/api/search?q=lighthouse")
groups = {g["type"]: g for g in out.get("groups", [])}
files = groups.get("files", {}).get("items", [])
check("search: groups for a member", s == 200 and list(groups) == ["models", "files", "generations", "folders", "posts"], str(list(groups)))
check("search: prefix match ranks before word match", [f["id"] for f in files[:2]] == [older, newer] and files[0]["match"] == "prefix" and files[1]["match"] == "word", str([(f["title"], f["match"]) for f in files]))
gens = groups.get("generations", {}).get("items", [])
check("search: generations by prompt", any(g["id"] == job_ok["id"] for g in gens), str([g["title"] for g in gens]))
s, out = a.call("GET", "/api/search?q=lighthouse&types=files&limit=1")
check("search: per-group cap and more flag", len(out["groups"][0]["items"]) == 1 and out["groups"][0]["more"], str(out["groups"][0].get("more")))
s, out = a.call("GET", "/api/search?q=%25&types=files,generations")
check("search: % is literal, not a wildcard", s == 200 and all(g["items"] == [] for g in out["groups"]), str([len(g["items"]) for g in out.get("groups", [])]))
s, out = a.call("GET", "/api/search?q=_&types=files")
check("search: _ is literal, not a wildcard", s == 200 and out["groups"][0]["items"] == [], f"{s}")
s, out = a.call("GET", "/api/search?q=lig&types=files")
check("search: short query works", s == 200 and len(out["groups"][0]["items"]) >= 2, f"{s}")
s, out = a.call("GET", "/api/search?q=flux&types=models")
items = out["groups"][0]["items"]
check("search: models with maker and capabilities", items and items[0]["match"] == "prefix" and items[0]["extra"]["maker"] and "text to image" in items[0]["extra"]["capabilities"], str(items[:1])[:200])
s, out = a.call("GET", "/api/search?q=text%20to%20video&types=models")
check("search: models by what they do", s == 200 and len(out["groups"][0]["items"]) >= 1 and all(i["extra"]["kind"] == "video" for i in out["groups"][0]["items"]), f"{s}")

s, out = b.call("GET", "/api/search?q=lighthouse")
bg = {g["type"]: g["items"] for g in out.get("groups", [])}
check("search: B cannot find A's private files or generations", bg.get("files") == [] and bg.get("generations") == [] and bg.get("posts") == [], str({k: len(v) for k, v in bg.items()}))
a.call("PATCH", f"/api/assets/{older}", {"isPublic": True})
s, out = b.call("GET", "/api/search?q=lighthouse&types=posts")
posts = out["groups"][0]["items"]
check("search: B finds A's public post", [p["id"] for p in posts] == [older] and posts[0]["extra"]["ownerHandle"], str(posts)[:200])
s, out = anon.call("GET", "/api/search?q=lighthouse&types=posts")
check("search: public posts signed out", [p["id"] for p in out["groups"][0]["items"]] == [older], f"{s}")
a.call("DELETE", f"/api/assets/{older}")
s, out = anon.call("GET", "/api/search?q=lighthouse&types=posts")
check("search: deleted post disappears", out["groups"][0]["items"] == [], f"{s}")

# --- recent searches and suggestions ----------------------------------------
for q in ["lighthouse", "neon city", "lighthouse"]:
    s, out = a.call("POST", "/api/search/recent", {"query": q})
s, out = a.call("GET", "/api/search/recent")
qs = [r["query"] for r in out.get("searches", [])]
check("recent: saved, no duplicates, newest first", qs == ["lighthouse", "neon city"], str(qs))
s, bout = b.call("GET", "/api/search/recent")
check("recent: B sees none of A's", bout.get("searches") == [], str(bout))
rid = out["searches"][1]["id"]
s, x = b.call("DELETE", f"/api/search/recent/{rid}")
check("recent: B cannot delete A's (404)", s == 404, f"{s}")
s, x = a.call("DELETE", f"/api/search/recent/{rid}")
check("recent: delete one", s == 200, f"{s}")
s, sug = a.call("GET", "/api/search/suggestions")
check("suggestions: popular models, recent items, recent searches", s == 200 and sug["popularModels"] and sug["recentItems"] and [r["query"] for r in sug["recentSearches"]] == ["lighthouse"], str({k: len(v) for k, v in sug.items()}))
check("suggestions: flux is popular after use", any(m["id"] == "flux-schnell" for m in sug["popularModels"]), str([m["id"] for m in sug["popularModels"]]))
s, x = a.call("DELETE", "/api/search/recent")
s, out = a.call("GET", "/api/search/recent")
check("recent: clear all", out.get("searches") == [], str(out))

# --- commands ---------------------------------------------------------------
s, out = a.call("GET", "/api/search/commands")
cmds = out.get("commands", [])
labels = [c["label"] for c in cmds]
check("commands: every primary destination", all(l in labels for l in ["Explore", "Image", "Video", "Audio", "Apps", "Library"]), str(labels))
check("commands: member actions, no sign-in", "sign-out" in [c["id"] for c in cmds] and "sign-in" not in [c["id"] for c in cmds], "")
s, out = a.call("GET", "/api/search/commands?q=lib")
check("commands: filtered and ranked", out["commands"] and out["commands"][0]["label"] == "Library", str([c["label"] for c in out["commands"]]))

# --- what's new ---------------------------------------------------------------
s, out = a.call("GET", "/api/notifications/whats-new")
total = len(out["items"])
first = out["items"][0]["id"]
s, out = a.call("POST", "/api/notifications/whats-new/seen", {"ids": [first, "not-a-real-id"]})
check("what's new: mark one seen", s == 200 and out["unseen"] == total - 1 and out["items"][0]["seen"], str(out.get("unseen")))
s, out = b.call("GET", "/api/notifications/whats-new")
check("what's new: seen state is per member", out["unseen"] == total, str(out.get("unseen")))
s, out = a.call("POST", "/api/notifications/whats-new/seen", {"all": True})
check("what's new: mark all seen", out["unseen"] == 0, str(out.get("unseen")))
s, out = a.call("POST", "/api/notifications/whats-new/seen", {"ids": 3})
check("what's new: bad body is 400", s == 400, f"{s}")

passed = sum(results)
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
