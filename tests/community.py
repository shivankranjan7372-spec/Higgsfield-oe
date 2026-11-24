"""API test for Explore and Community, in mock mode. Usage: community.py <base-url>"""
import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = sys.argv[1].rstrip("/")
results = []


class Client:
    """One browser: its own cookie jar. `anon` never signs in."""

    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, method, path, body=None, headers=None, raw=False):
        h = dict(headers or {})
        data = None
        if body is not None and not isinstance(body, bytes):
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        elif body is not None:
            data = body
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
        try:
            with self.opener.open(req, timeout=60) as res:
                payload, status = res.read(), res.status
        except urllib.error.HTTPError as err:
            payload, status = err.read(), err.code
        if raw:
            return status, payload
        try:
            return status, json.loads(payload or b"{}")
        except ValueError:
            return status, {"_text": payload[:200].decode("utf8", "replace")}


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def err(out):
    return (out.get("error") or {}).get("code")


def wait_ready(c):
    for _ in range(90):
        try:
            if c.call("GET", "/api/auth/me")[0] == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def wait_jobs(c, ids, seconds=90):
    deadline = time.time() + seconds
    jobs = {}
    while time.time() < deadline:
        for i in ids:
            jobs[i] = c.call("GET", f"/api/jobs/{i}")[1].get("job", {})
        if all(j.get("status") in ("succeeded", "failed", "canceled") for j in jobs.values()):
            break
        time.sleep(0.5)
    return [jobs[i] for i in ids]


def signup(c, name):
    s, out = c.call("POST", "/api/auth/signup", {"email": f"{name}-{uuid.uuid4().hex[:8]}@example.com", "password": "correct horse battery", "name": name})
    return out.get("user", {}) if s == 200 else {}


anon, alice, bob, carol, guest = Client(), Client(), Client(), Client(), Client()
check("server ready", wait_ready(anon))

# --- signed out, empty --------------------------------------------------------
s, out = anon.call("GET", "/api/explore")
check("explore: works signed out, empty at first", s == 200 and out.get("posts") == [] and out.get("nextCursor") is None, f"{s} {str(out)[:120]}")
s, out = anon.call("POST", "/api/community/posts", {"assetId": "ast_x"})
check("publish: signed out is 401", s == 401, f"{s}")

ua, ub, uc = signup(alice, "Alice"), signup(bob, "Bob"), signup(carol, "Carol")
check("three members signed up", ua.get("handle") and ub.get("handle") and uc.get("handle"), f"{ua.get('handle')} {ub.get('handle')} {uc.get('handle')}")
s, g = guest.call("POST", "/api/auth/guest")
check("guest account", s == 200 and g["user"]["isGuest"], f"{s}")

# --- alice makes four images ----------------------------------------------------
s, out = alice.call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a quiet harbour at dawn", "count": 4, "values": {"aspect": "16:9"}})
done = wait_jobs(alice, [j["id"] for j in out.get("jobs", [])])
assets = [a for j in done for a in j.get("assets", [])]
check("setup: four generated images", s == 200 and len(assets) == 4, f"{s} {len(assets)}")
if len(assets) < 4:
    print("cannot continue without images")
    sys.exit(1)
a1, a2, a3, a4 = (a["id"] for a in assets)

# --- publish ------------------------------------------------------------------
s, out = guest.call("POST", "/api/community/posts", {"assetId": a1})
check("publish: guest refused", s == 403 and err(out) == "account_required", f"{s} {err(out)}")
s, out = bob.call("POST", "/api/community/posts", {"assetId": a1})
check("publish: someone else's file is 404", s == 404, f"{s}")
s, out = alice.call("POST", "/api/community/posts", {"assetId": a1, "tags": "rain"})
check("publish: tags must be a list", s == 400, f"{s}")
s, out = alice.call("POST", "/api/community/posts", {"assetId": a1, "title": "x" * 500})
check("publish: title too long", s == 400, f"{s}")
s, out = alice.call("POST", "/api/community/posts", {"assetId": a1, "allowRecreate": "yes"})
check("publish: allowRecreate must be boolean", s == 400, f"{s}")
s, out = alice.call("POST", "/api/community/posts", {"assetId": a1, "title": "Harbour", "description": "First light.", "tags": ["Night City", "#rain", "rain"], "allowRecreate": True})
p1 = out.get("post", {})
check("publish: works", s == 200 and p1.get("id", "").startswith("pst_") and p1["tags"] == ["night-city", "rain"] and p1["allowRecreate"] is True, f"{s} {str(out)[:200]}")
check("publish: post shape", p1.get("author", {}).get("handle") == ua.get("handle") and p1.get("model", {}).get("id") == "flux-schnell" and p1.get("media", {}).get("url", "").startswith("/api/assets/") and p1.get("counts") == {"likes": 0, "saves": 0, "comments": 0, "views": 0}, str(p1)[:200])
s, out = alice.call("POST", "/api/community/posts", {"assetId": a1})
check("publish: twice is 409", s == 409 and err(out) == "already_published", f"{s} {err(out)}")
s, out = alice.call("POST", "/api/community/posts", {"assetId": a2, "title": "Private recipe", "allowRecreate": False})
p2 = out.get("post", {})
s3, out = alice.call("POST", "/api/community/posts", {"assetId": a3, "title": "Third"})
p3 = out.get("post", {})
check("publish: two more", s == 200 and s3 == 200 and p2.get("prompt") is not None, f"{s} {s3} author sees own prompt={p2.get('prompt')!r}")

s, _ = anon.call("GET", f"/api/assets/{a1}/file", raw=True)
check("published file serves signed out", s == 200, f"{s}")
s, _ = anon.call("GET", f"/api/assets/{a4}/file", raw=True)
check("unpublished file stays private", s == 404, f"{s}")

# --- feed -----------------------------------------------------------------------
s, out = anon.call("GET", "/api/explore?tab=new")
ids = [p["id"] for p in out.get("posts", [])]
check("explore new: newest first", s == 200 and ids == [p3.get("id"), p2.get("id"), p1.get("id")], f"{s} {ids}")
byid = {p["id"]: p for p in out.get("posts", [])}
check("explore: prompt only when recreate allowed", byid.get(p1["id"], {}).get("prompt") == "a quiet harbour at dawn" and byid.get(p2["id"], {}).get("prompt") is None and byid.get(p1["id"], {}).get("viewer") is None, "")
s, page1 = anon.call("GET", "/api/explore?tab=new&limit=2")
s2, page2 = anon.call("GET", f"/api/explore?tab=new&limit=2&cursor={page1.get('nextCursor')}")
got = [p["id"] for p in page1.get("posts", []) + page2.get("posts", [])]
check("explore: cursor paging", s == 200 and s2 == 200 and got == ids and page2.get("nextCursor") is None, f"{got}")
s, page1 = anon.call("GET", "/api/explore?tab=trending&limit=2")
s2, page2 = anon.call("GET", f"/api/explore?tab=trending&limit=2&cursor={page1.get('nextCursor')}")
got = [p["id"] for p in page1.get("posts", []) + page2.get("posts", [])]
check("explore trending: paging covers all once", s == 200 and s2 == 200 and sorted(got) == sorted(ids), f"{got}")
s, out = anon.call("GET", "/api/explore?model=flux-schnell&kind=image")
check("filter: model and kind", s == 200 and len(out["posts"]) == 3, f"{s} {len(out.get('posts', []))}")
s, out = anon.call("GET", "/api/explore?kind=video")
check("filter: kind with no posts", s == 200 and out["posts"] == [], f"{s}")
s, out = anon.call("GET", "/api/explore?tab=new&tag=%23Rain")
check("filter: tag", s == 200 and [p["id"] for p in out["posts"]] == [p1["id"]], f"{s} {len(out.get('posts', []))}")
s, out = anon.call("GET", "/api/explore/tags")
check("tags: popular tags", s == 200 and {"tag": "rain", "posts": 1} in out.get("tags", []), f"{str(out)[:120]}")
s, out = anon.call("GET", "/api/explore/models")
check("models: posted models", s == 200 and out.get("models", [{}])[0].get("id") == "flux-schnell" and out["models"][0]["posts"] == 3, f"{str(out)[:120]}")
for q, name in (("tab=bogus", "tab"), ("period=year&tab=top", "period"), ("model=nope", "model"), ("kind=pdf", "kind"), ("cursor=%%%", "cursor")):
    s, out = anon.call("GET", f"/api/explore?{q}")
    check(f"filter: bad {name} is 400", s == 400, f"{s}")
s, out = anon.call("GET", "/api/explore?tab=following")
check("following tab: signed out is 401", s == 401, f"{s}")

# --- post page and recreate -------------------------------------------------------
s, out = anon.call("GET", f"/api/community/posts/{p1['id']}")
check("post: readable signed out", s == 200 and out["post"]["id"] == p1["id"], f"{s}")
s, out = anon.call("GET", "/api/community/posts/pst_nope")
check("post: unknown is 404", s == 404, f"{s}")
s, rc = anon.call("GET", f"/api/community/posts/{p1['id']}/recreate")
check("recreate: allowed post gives a job payload", s == 200 and rc.get("modelId") == "flux-schnell" and rc.get("prompt") == "a quiet harbour at dawn" and rc.get("values", {}).get("aspect") == "16:9", f"{s} {str(rc)[:160]}")
s, out = bob.call("GET", f"/api/community/posts/{p2['id']}/recreate")
check("recreate: refused when the author keeps settings private", s == 403 and err(out) == "recreate_off", f"{s} {err(out)}")
s, out = alice.call("GET", f"/api/community/posts/{p2['id']}/recreate")
check("recreate: author can always recreate", s == 200, f"{s}")
s, out = bob.call("POST", "/api/jobs", {"modelId": rc.get("modelId"), "prompt": rc.get("prompt"), "values": rc.get("values")})
check("recreate: payload is accepted by POST /api/jobs", s == 200 and out.get("jobs"), f"{s} {str(out)[:120]}")
wait_jobs(bob, [j["id"] for j in out.get("jobs", [])])

# --- likes, saves, views ------------------------------------------------------------
s, out = anon.call("POST", f"/api/community/posts/{p1['id']}/like")
check("like: signed out is 401", s == 401, f"{s}")
s, out = bob.call("POST", f"/api/community/posts/{p1['id']}/like")
s2, out2 = bob.call("POST", f"/api/community/posts/{p1['id']}/like")
check("like: idempotent", s == 200 and out == {"liked": True, "likes": 1} and out2 == {"liked": True, "likes": 1}, f"{out} {out2}")
s, out = guest.call("POST", f"/api/community/posts/{p1['id']}/like")
check("like: guests may like", s == 200 and out.get("likes") == 2, f"{s} {out}")
s, out = guest.call("DELETE", f"/api/community/posts/{p1['id']}/like")
check("unlike", s == 200 and out == {"liked": False, "likes": 1}, f"{out}")
s, out = bob.call("POST", f"/api/community/posts/{p1['id']}/like", headers={"Origin": "https://evil.example"})
check("like: cross-site refused", s == 403, f"{s}")
s, out = bob.call("POST", f"/api/community/posts/{p2['id']}/save")
check("save", s == 200 and out == {"saved": True, "saves": 1}, f"{out}")
s, out = guest.call("POST", f"/api/community/posts/{p3['id']}/save")
check("save: guests may save", s == 200 and out.get("saved") is True, f"{s}")
s, out = bob.call("GET", "/api/community/saved")
check("saved list: own saves", s == 200 and [p["id"] for p in out["posts"]] == [p2["id"]] and out["posts"][0]["viewer"]["saved"] is True, f"{s} {str(out)[:120]}")
s, out = alice.call("GET", "/api/community/saved")
check("saved list: private to each member", s == 200 and out["posts"] == [], f"{s} {len(out.get('posts', []))}")
s, out = anon.call("GET", "/api/community/saved")
check("saved list: signed out is 401", s == 401, f"{s}")
s, v1 = anon.call("POST", f"/api/community/posts/{p1['id']}/view")
s2, v2 = anon.call("POST", f"/api/community/posts/{p1['id']}/view")
s3, v3 = bob.call("POST", f"/api/community/posts/{p1['id']}/view")
check("views: once per viewer per day", v1.get("views") == 1 and v2.get("views") == 1 and v3.get("views") == 2, f"{v1} {v2} {v3}")
s, out = bob.call("GET", f"/api/community/posts/{p1['id']}")
check("post: viewer state", s == 200 and out["post"]["viewer"] == {"liked": True, "saved": False, "followingAuthor": False, "isAuthor": False} and out["post"]["counts"]["views"] == 2, f"{str(out.get('post', {}).get('viewer'))}")

# --- comments ------------------------------------------------------------------------
path = f"/api/community/posts/{p1['id']}/comments"
s, out = anon.call("POST", path, {"body": "hi"})
check("comment: signed out is 401", s == 401, f"{s}")
s, out = guest.call("POST", path, {"body": "hi"})
check("comment: guest refused", s == 403 and err(out) == "account_required", f"{s}")
s, out = bob.call("POST", path, {"body": "   "})
check("comment: empty refused", s == 400, f"{s}")
s, out = bob.call("POST", path, {"body": "x" * 1001})
check("comment: too long refused", s == 400, f"{s}")
s, out = bob.call("POST", path, {"body": "Lovely light."})
c1 = out.get("comment", {})
check("comment: posted", s == 200 and c1.get("body") == "Lovely light." and c1.get("author", {}).get("handle") == ub.get("handle") and c1.get("canDelete") is True, f"{s} {str(out)[:160]}")
s, out = anon.call("GET", path)
check("comments: readable signed out", s == 200 and [c["id"] for c in out["comments"]] == [c1.get("id")] and out["comments"][0]["canDelete"] is False, f"{s}")
s, out = carol.call("DELETE", f"/api/community/comments/{c1.get('id')}")
check("comment: a third member cannot delete it", s == 403, f"{s}")
s, out = alice.call("DELETE", f"/api/community/comments/{c1.get('id')}")
check("comment: post owner can delete it", s == 200, f"{s}")
s, out = bob.call("POST", path, {"body": "Second try."})
c2 = out.get("comment", {})
s, out = bob.call("DELETE", f"/api/community/comments/{c2.get('id')}")
check("comment: author can delete own", s == 200, f"{s}")
s, out = bob.call("POST", path, {"body": "Keeping this one."})
s, out = anon.call("GET", f"/api/community/posts/{p1['id']}")
check("comments: count follows adds and deletes", out.get("post", {}).get("counts", {}).get("comments") == 1, f"{out.get('post', {}).get('counts')}")

# --- ranking -----------------------------------------------------------------------
s, out = anon.call("GET", "/api/explore?tab=trending")
check("trending: most engaged first", s == 200 and out["posts"][0]["id"] == p1["id"], f"{[p['id'] for p in out.get('posts', [])]}")
s, out = anon.call("GET", "/api/explore?tab=top&period=day")
check("top day: most liked first", s == 200 and out["posts"][0]["id"] == p1["id"] and len(out["posts"]) == 3, f"{s}")

# --- follows and profiles -------------------------------------------------------------
ha, hb = ua.get("handle"), ub.get("handle")
s, out = bob.call("POST", f"/api/profiles/{ha}/follow")
check("follow", s == 200 and out == {"following": True, "followers": 1}, f"{s} {out}")
s, out = bob.call("POST", f"/api/profiles/{ha}/follow")
check("follow: idempotent", s == 200 and out.get("followers") == 1, f"{out}")
s, out = bob.call("POST", f"/api/profiles/{hb}/follow")
check("follow: not yourself", s == 400, f"{s}")
s, out = guest.call("POST", f"/api/profiles/{ha}/follow")
check("follow: guest refused", s == 403, f"{s}")
s, out = bob.call("GET", "/api/explore?tab=following")
check("following tab: posts of followed members", s == 200 and len(out["posts"]) == 3 and out["posts"][0]["viewer"]["followingAuthor"] is True, f"{s} {len(out.get('posts', []))}")
s, out = carol.call("GET", "/api/explore?tab=following")
check("following tab: empty when following nobody", s == 200 and out["posts"] == [], f"{s}")
s, out = anon.call("GET", f"/api/profiles/{ha}")
pr = out.get("profile", {})
check("profile: public", s == 200 and pr.get("handle") == ha and pr.get("name") == "Alice" and pr.get("counts", {}).get("posts") == 3 and pr["counts"]["followers"] == 1 and pr["counts"]["likes"] == 1 and pr.get("viewer") is None, f"{s} {str(pr)[:200]}")
check("profile: no private fields", "email" not in pr and "plan" not in pr, str(sorted(pr.keys())))
s, out = bob.call("GET", f"/api/profiles/{ha}")
check("profile: viewer state", out.get("profile", {}).get("viewer") == {"isSelf": False, "following": True, "followsYou": False, "hidden": False}, f"{out.get('profile', {}).get('viewer')}")
s, out = anon.call("GET", f"/api/profiles/{ha}/posts")
check("profile: post grid", s == 200 and len(out["posts"]) == 3, f"{s}")
s, out = anon.call("GET", f"/api/profiles/{ha}/followers")
check("profile: followers list", s == 200 and [m["handle"] for m in out["members"]] == [hb], f"{s} {out}")
s, out = anon.call("GET", f"/api/profiles/{hb}/following")
check("profile: following list", s == 200 and [m["handle"] for m in out["members"]] == [ha], f"{s}")
s, out = anon.call("GET", f"/api/profiles/{g['user']['handle']}")
check("profile: guests have none", s == 404, f"{s}")
s, out = anon.call("GET", "/api/profiles/nobody-here")
check("profile: unknown is 404", s == 404, f"{s}")

# --- hide and report ---------------------------------------------------------------------
s, out = bob.call("POST", f"/api/profiles/{ha}/hide")
s2, feed = bob.call("GET", "/api/explore?tab=new")
s3, anonfeed = anon.call("GET", "/api/explore?tab=new")
check("hide: member's posts gone from my feed only", s == 200 and feed["posts"] == [] and len(anonfeed["posts"]) == 3, f"{s} mine={len(feed.get('posts', []))} anon={len(anonfeed.get('posts', []))}")
s, out = bob.call("GET", "/api/community/hidden")
check("hide: listed", s == 200 and [m["handle"] for m in out["members"]] == [ha], f"{s}")
s, out = carol.call("GET", "/api/community/hidden")
check("hide: list is private", s == 200 and out["members"] == [], f"{s}")
bob.call("DELETE", f"/api/profiles/{ha}/hide")
s, feed = bob.call("GET", "/api/explore?tab=new")
check("hide: undone", len(feed.get("posts", [])) == 3, f"{len(feed.get('posts', []))}")
s, out = bob.call("POST", f"/api/community/posts/{p3['id']}/report", {"reason": "nonsense"})
check("report: bad reason", s == 400, f"{s}")
s, out = alice.call("POST", f"/api/community/posts/{p3['id']}/report", {"reason": "spam"})
check("report: not your own post", s == 400, f"{s}")
s, out = guest.call("POST", f"/api/community/posts/{p3['id']}/report", {"reason": "spam"})
check("report: guest refused", s == 403, f"{s}")
s, out = bob.call("POST", f"/api/community/posts/{p3['id']}/report", {"reason": "spam", "note": "Looks copied."})
s2, feed = bob.call("GET", "/api/explore?tab=new")
check("report: stored, post leaves the reporter's feed", s == 200 and out == {"reported": True} and p3["id"] not in [p["id"] for p in feed["posts"]], f"{s} {out}")

# --- contests ----------------------------------------------------------------------------
s, out = anon.call("GET", "/api/community/contests")
cs = out.get("contests", [])
check("contests: listed signed out", s == 200 and [c["slug"] for c in cs] == ["quiet-cities", "tiny-loops", "first-light"] and [c["phase"] for c in cs] == ["open", "upcoming", "ended"], f"{s} {[(c.get('slug'), c.get('phase')) for c in cs]}")
s, out = anon.call("GET", "/api/community/contests/quiet-cities")
check("contest: detail", s == 200 and out["contest"]["canEnter"] and out["contest"]["kind"] == "image" and out["contest"]["rules"], f"{s}")
s, out = anon.call("GET", "/api/community/contests/nope")
check("contest: unknown is 404", s == 404, f"{s}")
s, out = bob.call("POST", "/api/community/contests/quiet-cities/entries", {"postId": p1["id"]})
check("contest: cannot enter someone else's post", s == 404, f"{s}")
s, out = alice.call("POST", "/api/community/contests/quiet-cities/entries", {"postId": p1["id"]})
check("contest: enter", s == 200 and out["contest"]["viewer"]["entryPostId"] == p1["id"] and out["contest"]["entries"] == 1, f"{s} {str(out)[:160]}")
s, out = alice.call("POST", "/api/community/contests/quiet-cities/entries", {"postId": p2["id"]})
check("contest: one entry per member", s == 409 and err(out) == "already_entered", f"{s} {err(out)}")
s, out = alice.call("POST", "/api/community/contests/tiny-loops/entries", {"postId": p2["id"]})
check("contest: not open yet", s == 409 and err(out) == "contest_closed", f"{s}")
s, out = alice.call("POST", "/api/community/contests/first-light/entries", {"postId": p2["id"]})
check("contest: already ended", s == 409 and err(out) == "contest_closed", f"{s}")
vote = f"/api/community/contests/quiet-cities/entries/{p1['id']}/vote"
s, out = alice.call("POST", vote)
check("vote: not for your own entry", s == 400, f"{s}")
s, out = guest.call("POST", vote)
check("vote: guest refused", s == 403, f"{s}")
s, out = anon.call("POST", vote)
check("vote: signed out is 401", s == 401, f"{s}")
s, out = bob.call("POST", vote)
s2, out2 = bob.call("POST", vote)
check("vote: once per member per entry", s == 200 and out == {"voted": True, "votes": 1} and out2 == {"voted": True, "votes": 1}, f"{out} {out2}")
carol.call("POST", vote)
s, out = bob.call("GET", "/api/community/contests/quiet-cities/entries")
e = (out.get("entries") or [{}])[0]
check("leaderboard", s == 200 and e.get("rank") == 1 and e.get("votes") == 2 and e.get("viewer") == {"voted": True} and e.get("post", {}).get("id") == p1["id"], f"{s} {str(e)[:160]}")
s, out = carol.call("DELETE", vote)
check("vote: can be taken back", s == 200 and out == {"voted": False, "votes": 1}, f"{out}")
s, out = bob.call("POST", "/api/community/contests/quiet-cities/entries/pst_nope/vote")
check("vote: unknown entry is 404", s == 404, f"{s}")

# --- editing and unpublishing ----------------------------------------------------------------
s, out = bob.call("PATCH", f"/api/community/posts/{p2['id']}", {"title": "mine now"})
check("edit: someone else's post is 404", s == 404, f"{s}")
s, out = alice.call("PATCH", f"/api/community/posts/{p2['id']}", {"allowRecreate": True, "tags": ["harbour"], "title": "Recipe shared"})
check("edit: author", s == 200 and out["post"]["allowRecreate"] and out["post"]["tags"] == ["harbour"] and out["post"]["title"] == "Recipe shared", f"{s}")
s, out = bob.call("GET", f"/api/community/posts/{p2['id']}/recreate")
check("edit: recreate now open", s == 200, f"{s}")
s, out = bob.call("DELETE", f"/api/community/posts/{p3['id']}")
check("unpublish: someone else's post is 404", s == 404, f"{s}")
s, out = alice.call("DELETE", f"/api/community/posts/{p3['id']}")
s2, _ = anon.call("GET", f"/api/community/posts/{p3['id']}")
s3, _ = anon.call("GET", f"/api/assets/{a3}/file", raw=True)
s4, own = alice.call("GET", f"/api/assets/{a3}")
check("unpublish: post gone, file private again but kept", s == 200 and s2 == 404 and s3 == 404 and s4 == 200 and own["asset"]["isPublic"] is False, f"{s} {s2} {s3} {s4}")
s, out = alice.call("POST", "/api/community/posts", {"assetId": a3})
check("unpublish: can publish again", s == 200, f"{s}")
alice.call("DELETE", f"/api/assets/{a2}")
s, _ = anon.call("GET", f"/api/community/posts/{p2['id']}")
check("deleting the file in the library hides the post", s == 404, f"{s}")

# --- abuse limits -------------------------------------------------------------------------------
codes = [carol.call("POST", f"/api/community/posts/{p1['id']}/report", {"reason": "other"})[0] for _ in range(22)]
check("rate limit: reports", codes[0] == 200 and codes[-1] == 429, f"{codes[:2]}...{codes[-2:]}")
codes = [carol.call("POST", path, {"body": f"comment {i}"})[0] for i in range(12)]
check("rate limit: comments", codes[0] == 200 and codes[-1] == 429, f"{codes}")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
