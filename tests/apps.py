"""API test for apps (one-purpose tools) in mock mode. Usage: apps.py <base-url>"""
import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1].rstrip("/")
results = []


def session():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


opener = session()


def call(method, path, body=None, headers=None):
    data = None
    h = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with opener.open(req, timeout=60) as res:
            payload, status = res.read(), res.status
    except urllib.error.HTTPError as err:
        payload, status = err.read(), err.code
    try:
        return status, json.loads(payload or b"{}")
    except ValueError:
        return status, {"_text": payload[:200].decode("utf8", "replace")}


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def err(out):
    return out.get("error", {}).get("message", "") if isinstance(out, dict) else ""


def wait_jobs(ids, seconds=90):
    deadline = time.time() + seconds
    jobs = {}
    while time.time() < deadline:
        for i in ids:
            if jobs.get(i, {}).get("status") in ("succeeded", "failed", "canceled"):
                continue
            _, out = call("GET", f"/api/jobs/{i}")
            jobs[i] = out.get("job", {})
        if all(j.get("status") in ("succeeded", "failed", "canceled") for j in jobs.values()):
            break
        time.sleep(0.5)
    return [jobs[i] for i in ids]


# --- signed out: the catalog is public, running is not ------------------------------------
s, cat = call("GET", "/api/apps")
apps = cat.get("apps", [])
available = [a for a in apps if a["status"] == "available"]
check("catalog: listed signed out", s == 200 and len(apps) >= 40 and all(a["pinned"] is None for a in apps), f"{s} {len(apps)} apps")
check("catalog: 40+ runnable apps", len(available) >= 40, f"{len(available)} available")
check("catalog: every category present", {c["id"] for c in cat.get("categories", []) if c["count"] > 0} == {"image-tool", "video-tool", "effect", "template"}, str(cat.get("categories")))
check("catalog: soon apps have no price and a note", all(a["price"] is None and a["note"] for a in apps if a["status"] == "soon") and any(a["status"] == "soon" for a in apps))
check("catalog: runnable apps have a price", all(a["price"] and a["price"]["millicredits"] > 0 for a in available))
s, rep = call("GET", "/api/apps/check")
check("catalog check: no problems", s == 200 and rep.get("ok") is True and rep.get("available") == len(available), f"{s} {rep.get('problems', [])[:3]}")

s, out = call("GET", "/api/apps?category=effect")
check("filter: category", s == 200 and out["apps"] and all(a["category"] == "effect" for a in out["apps"]), f"{s} {len(out.get('apps', []))}")
s, out = call("GET", "/api/apps?tag=product")
check("filter: tag", s == 200 and out["apps"] and all("product" in a["tags"] for a in out["apps"]), f"{s} {len(out.get('apps', []))}")
s, out = call("GET", "/api/apps?q=relight")
check("filter: search", s == 200 and [a["id"] for a in out["apps"]][:1] == ["relight"], f"{s} {[a['id'] for a in out.get('apps', [])]}")
s, out = call("GET", "/api/apps?q=zzzzqqq")
check("filter: search with no match", s == 200 and out["apps"] == [], f"{s}")
s, out = call("GET", "/api/apps?sort=new")
added = [a["added"] for a in out.get("apps", [])]
check("sort: new", s == 200 and added == sorted(added, reverse=True), f"{s} {added[:3]}")
s, out = call("GET", "/api/apps?status=soon")
check("filter: status soon", s == 200 and out["apps"] and all(a["status"] == "soon" for a in out["apps"]), f"{s}")
s, out = call("GET", "/api/apps?category=nope")
check("filter: unknown category is 400", s == 400, f"{s}")
s, out = call("GET", "/api/apps?sort=random")
check("sort: unknown sort is 400", s == 400, f"{s}")

s, one = call("GET", "/api/apps/restyle")
form = one.get("app", {}).get("form", {})
check("read: app with form", s == 200 and form.get("fields") and form.get("inputs") and form["inputs"][0]["accept"] == ["image"], f"{s} {str(one)[:160]}")
check("read: prompt fragments stay private", "prompt" not in json.dumps(form.get("fields", [])) and "template" not in one.get("app", {}), "")
check("read: open controls listed", [c["id"] for c in form.get("controls", [])] == ["aspect"], str([c.get("id") for c in form.get("controls", [])]))
s, out = call("GET", "/api/apps/nope")
check("read: unknown app is 404", s == 404 and out["error"]["code"] == "not_found", f"{s}")
s, out = call("POST", "/api/apps/restyle/run", {"fields": {}})
check("signed out: run is 401", s == 401, f"{s}")
for path in ("/api/apps/pinned", "/api/apps/recent", "/api/apps/restyle/runs"):
    s, out = call("GET", path)
    check(f"signed out: {path} is 401", s == 401, f"{s}")
s, out = call("PUT", "/api/apps/restyle/pin")
check("signed out: pin is 401", s == 401, f"{s}")
s, out = call("POST", "/api/apps/restyle/run", {}, headers={"Origin": "https://evil.example"})
check("cross-site run refused", s == 403, f"{s}")

# --- price -------------------------------------------------------------------------------
s, p = call("POST", "/api/apps/restyle/price", {})
check("price: defaults match the list", s == 200 and p["price"]["millicredits"] == one["app"]["price"]["millicredits"], f"{s} {p}")
s, p2 = call("POST", "/api/apps/restyle/price", {"count": 2})
check("price: two results cost twice", s == 200 and p2["price"]["millicredits"] == 2 * p["price"]["millicredits"] and p2["price"]["count"] == 2, f"{s} {p2}")
s, cm = call("POST", "/api/apps/camera-move/price", {"values": {"aspect": "9:16", "duration": "8"}})
check("price: open value kept, fixed value ignored", s == 200 and cm["values"] == {"aspect": "9:16"}, f"{s} {cm}")
s, out = call("POST", "/api/apps/restyle/price", {"fields": {"style": "nope"}})
check("price: bad choice is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/upscale/price", {})
check("price: soon app is 409", s == 409 and out["error"]["code"] == "app_unavailable", f"{s}")

# --- a member with credits and a picture ---------------------------------------------------
s, g = call("POST", "/api/auth/guest")
check("guest account", s == 200, f"{s}")
for _ in range(2):
    call("POST", "/api/wallet/topup", {"packId": "pack-2000"})
s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a red bicycle", "count": 1})
img = wait_jobs([j["id"] for j in out.get("jobs", [])])
picture = img[0]["assets"][0]["id"] if img and img[0].get("assets") else None
check("setup: a picture to use", picture is not None, f"{s} {str(out)[:120]}")

# --- validation -----------------------------------------------------------------------------
s, out = call("POST", "/api/apps/restyle/run", {"fields": {}, "inputs": {}})
check("run: missing photo is 400", s == 400 and "photo" in err(out).lower(), f"{s} {err(out)}")
s, out = call("POST", "/api/apps/restyle/run", {"fields": {"style": "crayon"}, "inputs": {"photo": [picture]}})
check("run: unknown choice is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/restyle/run", {"fields": {"strength": 9}, "inputs": {"photo": [picture]}})
check("run: number out of range is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/relight/run", {"fields": {"tint": "red; drop"}, "inputs": {"photo": [picture]}})
check("run: bad colour is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/new-background/run", {"fields": {}, "inputs": {"photo": [picture]}})
check("run: required text is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/new-background/run", {"fields": {"background": "x" * 500}, "inputs": {"photo": [picture]}})
check("run: text too long is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/restyle/run", {"inputs": {"photo": [picture, picture]}})
check("run: too many files is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/restyle/run", {"inputs": {"photo": "abc"}})
check("run: inputs must be lists", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/restyle/run", {"inputs": {"photo": [picture]}, "count": 9})
check("run: count too high is 400", s == 400, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/restyle/run", {"inputs": {"photo": ["ast_doesnotexist000"]}})
check("run: unknown file is 404", s == 404, f"{s} {err(out)}")
s, out = call("POST", "/api/apps/face-swap/run", {"inputs": {}})
check("run: soon app is 409", s == 409 and out["error"]["code"] == "app_unavailable", f"{s}")
s, out = call("POST", "/api/apps/restyle/run", "not json")
check("run: body must be an object", s == 400, f"{s}")

# The template only substitutes: braces typed by the member never become placeholders.
s, out = call("POST", "/api/apps/new-background/run", {"fields": {"background": "a beach {{background}} {{style}}"}, "inputs": {"photo": [picture]}})
jobs = out.get("jobs", [])
check("template: member text cannot inject placeholders", s == 200 and jobs and "{" not in jobs[0]["prompt"] and "a beach" in jobs[0]["prompt"], f"{s} {jobs[0]['prompt'][:120] if jobs else err(out)}")
inject_ids = [j["id"] for j in jobs]

# A failing run gives the credits back.
s, me = call("GET", "/api/auth/me")
before_fail = me["balance"]
wait_jobs(inject_ids)
s, me = call("GET", "/api/auth/me")
before_fail = me["balance"]
s, out = call("POST", "/api/apps/remove-object/run", {"fields": {"thing": "the lamp [fail]"}, "inputs": {"photo": [picture]}})
done = wait_jobs([j["id"] for j in out.get("jobs", [])])
s2, me = call("GET", "/api/auth/me")
check("failure: job failed and credits returned", s == 200 and done and done[0]["status"] == "failed" and me["balance"] == before_fail, f"{s} {[d.get('status') for d in done]} {before_fail} -> {me.get('balance')}")

# --- every available app runs once ----------------------------------------------------------
def fill(app):
    fields = {f["id"]: "sample text" for f in app["form"]["fields"] if f["type"] == "text" and f["required"] and not f["default"]}
    inputs = {i["id"]: [picture] * i["min"] for i in app["form"]["inputs"] if i["min"] > 0 and "image" in i["accept"]}
    return {"fields": fields, "inputs": inputs}


pending = {}  # job id -> app
ran = {}
bad = []
queue = list(available)
deadline = time.time() + 400
while (queue or pending) and time.time() < deadline:
    while queue and len(pending) < 4:
        summary = queue.pop(0)
        _, detail = call("GET", f"/api/apps/{summary['id']}")
        app = detail["app"]
        s, out = call("POST", f"/api/apps/{app['id']}/run", fill(app))
        if s != 200:
            bad.append((app["id"], s, err(out)))
            continue
        ran[app["id"]] = {"app": app, "run": out["run"], "jobs": out["jobs"]}
        for j in out["jobs"]:
            pending[j["id"]] = app["id"]
    for jid in list(pending):
        _, out = call("GET", f"/api/jobs/{jid}")
        job = out.get("job", {})
        if job.get("status") in ("succeeded", "failed", "canceled"):
            for j in ran[pending[jid]]["jobs"]:
                if j["id"] == jid:
                    j.update(job)
            del pending[jid]
    time.sleep(0.4)

check("all apps: every run accepted", not bad, str(bad[:4]))
wrong = []
for app_id, r in ran.items():
    app, jobs = r["app"], r["jobs"]
    ok = (
        jobs
        and all(j["status"] == "succeeded" for j in jobs)
        and all(j["surface"] == f"app-{app_id}" and j["meta"].get("appId") == app_id and j["meta"].get("appRunId") == r["run"]["id"] for j in jobs)
        and all(a["kind"] == app["result"] for j in jobs for a in j.get("assets", []))
        and sum(len(j.get("assets", [])) for j in jobs) >= 1
        and sum(j["cost"] for j in jobs) == app["price"]["millicredits"]
        and "{{" not in jobs[0]["prompt"]
    )
    if not ok:
        wrong.append((app_id, [(j.get("status"), j.get("surface"), j.get("cost"), j.get("error")) for j in jobs], app["price"]["millicredits"]))
check(f"all apps: {len(ran)} of {len(available)} ran, succeeded, made the right kind, charged the shown price", len(ran) == len(available) and not wrong, str(wrong[:3]))

# --- past runs, recent, popular -------------------------------------------------------------
s, out = call("POST", "/api/apps/restyle/run", {"fields": {"style": "pixel"}, "inputs": {"photo": [picture]}, "values": {"aspect": "16:9"}})
second = out.get("run", {})
check("run: open value used", s == 200 and out["jobs"][0]["params"].get("aspect") == "16:9" and second.get("values") == {"aspect": "16:9"}, f"{s} {str(out)[:160]}")
wait_jobs([j["id"] for j in out.get("jobs", [])])
s, runs = call("GET", "/api/apps/restyle/runs?limit=1")
r0 = runs.get("runs", [{}])[0]
check("runs: newest first with results", s == 200 and r0.get("id") == second.get("id") and r0["fields"]["style"] == "pixel" and r0["inputs"] == {"photo": [picture]} and r0["jobs"][0]["assets"], f"{s} {str(runs)[:160]}")
s, page2 = call("GET", f"/api/apps/restyle/runs?limit=5&before={r0.get('cursor')}")
check("runs: second page", s == 200 and len(page2["runs"]) == 1 and page2["runs"][0]["cursor"] < r0["cursor"], f"{s} {len(page2.get('runs', []))}")
s, out = call("GET", "/api/apps/nope/runs")
check("runs: unknown app is 404", s == 404, f"{s}")
s, rec = call("GET", "/api/apps/recent?limit=50")
check("recent: last used first", s == 200 and rec["apps"][0]["id"] == "restyle" and rec["apps"][0]["lastRunAt"] and len(rec["apps"]) == min(50, len({*ran, "new-background", "remove-object"})), f"{s} {[a['id'] for a in rec.get('apps', [])][:3]} {len(rec.get('apps', []))}")
s, pop = call("GET", "/api/apps?sort=popular")
top = pop.get("apps", [{}])[0]
check("sort: popular counts runs", s == 200 and top["runs"] >= 2 and top["id"] in ("restyle", "new-background", "remove-object"), f"{s} {top.get('id')} {top.get('runs')}")

# --- pins --------------------------------------------------------------------------------------
s1, _ = call("PUT", "/api/apps/restyle/pin")
s2, _ = call("PUT", "/api/apps/camera-move/pin")
s3, _ = call("PUT", "/api/apps/camera-move/pin")
s, pins = call("GET", "/api/apps/pinned")
check("pins: pinned, newest first, repeat is harmless", (s1, s2, s3, s) == (200, 200, 200, 200) and [a["id"] for a in pins["apps"]] == ["camera-move", "restyle"], f"{[a['id'] for a in pins.get('apps', [])]}")
s, one = call("GET", "/api/apps/restyle")
check("pins: shown on the app", one["app"]["pinned"] is True, "")
s, out = call("DELETE", "/api/apps/restyle/pin")
s, pins = call("GET", "/api/apps/pinned")
check("pins: unpin", s == 200 and [a["id"] for a in pins["apps"]] == ["camera-move"], f"{[a['id'] for a in pins.get('apps', [])]}")
s, out = call("PUT", "/api/apps/nope/pin")
check("pins: unknown app is 404", s == 404, f"{s}")

# --- another member sees none of it -------------------------------------------------------------
mine, opener = opener, session()
call("POST", "/api/auth/guest")
s, out = call("GET", "/api/apps/restyle/runs")
check("privacy: other member has no runs", s == 200 and out["runs"] == [], f"{s} {len(out.get('runs', []))}")
s, out = call("GET", "/api/apps/recent")
check("privacy: other member has no recent apps", s == 200 and out["apps"] == [], f"{s}")
s, out = call("GET", "/api/apps/pinned")
check("privacy: other member has no pins", s == 200 and out["apps"] == [], f"{s}")
s, out = call("POST", "/api/apps/restyle/run", {"inputs": {"photo": [picture]}})
check("privacy: other member cannot use my picture", s == 404, f"{s} {err(out)}")
s, out = call("GET", f"/api/jobs/{second['jobs'][0]['id']}") if second.get("jobs") else (0, {})
check("privacy: other member cannot read my app job", s == 404, f"{s}")
opener = mine

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
