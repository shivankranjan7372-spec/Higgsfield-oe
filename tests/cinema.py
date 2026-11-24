"""Shot Planner (/cinema) API test, mock mode. Usage: cinema.py <base-url>"""
import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = sys.argv[1].rstrip("/")
results = []


def new_opener():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


opener = new_opener()


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
        with opener.open(req, timeout=120) as res:
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


def err(out):
    return out.get("error", {}).get("code", "") if isinstance(out, dict) else ""


def multipart(field, filename, content):
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def wait_shot(shot_id, seconds=60):
    deadline = time.time() + seconds
    shot = {}
    while time.time() < deadline:
        _, out = call("GET", f"/api/cinema/shots/{shot_id}")
        shot = out.get("shot", {})
        if shot and shot.get("status") != "generating":
            return shot
        time.sleep(0.5)
    return shot


# --- signed out -----------------------------------------------------------------------
s, out = call("GET", "/api/cinema/projects")
check("signed out: projects refused", s == 401 and err(out) == "unauthorized", f"{s}")
s, out = call("POST", "/api/cinema/projects", {"title": "x"})
check("signed out: create refused", s == 401, f"{s}")
s, cat = call("GET", "/api/cinema/catalog")
check("catalog: public, has presets and models",
      s == 200 and cat["presets"]["shot"]["size"] and cat["presets"]["look"]["filmStock"]
      and any(m["id"] == "nano-banana-2" for m in cat["models"]["still"])
      and any(m["canAnimate"] for m in cat["models"]["video"]), f"{s}")
check("catalog: only usable video models",
      all(m["id"] not in ("sora-2-pro", "runway-aleph-2", "heygen-avatar-iv") for m in cat["models"]["video"]))

# --- member A ---------------------------------------------------------------------------
s, g = call("POST", "/api/auth/guest")
check("guest A", s == 200, f"{s}")
s, out = call("POST", "/api/cinema/projects", {"title": "x"}, headers={"Origin": "https://evil.example"})
check("cross-site create refused", s == 403, f"{s}")
s, out = call("POST", "/api/cinema/projects", {"title": "  "})
check("project: empty title refused", s == 400, f"{s}")
s, out = call("POST", "/api/cinema/projects", {"title": "T", "aspect": "7:3"})
check("project: bad aspect refused", s == 400, f"{s}")
s, out = call("POST", "/api/cinema/projects", {"title": "T", "stillModelId": "veo-3.1"})
check("project: video model as still model refused", s == 400, f"{s}")
s, out = call("POST", "/api/cinema/projects", {"title": "T", "look": {"grade": "no-such"}})
check("project: unknown look preset refused", s == 400, f"{s}")
s, out = call("POST", "/api/cinema/projects", {
    "title": "The Lighthouse Keeper", "logline": "A keeper waits for a ship that never comes.", "aspect": "16:9",
    "look": {"filmStock": "35mm-color", "grade": "cold-steel", "lensFamily": "anamorphic", "lighting": "blue-hour"},
})
project = out.get("project", {})
pid = project.get("id", "")
check("project: created with look and defaults",
      s == 200 and project["look"]["grade"] == "cold-steel" and project["stillModelId"] and project["videoModelId"], f"{s} {str(out)[:160]}")
s, out = call("GET", "/api/cinema/projects")
check("project: listed", s == 200 and any(p["id"] == pid for p in out["projects"]), f"{s}")
s, out = call("PATCH", f"/api/cinema/projects/{pid}", {"logline": "A keeper waits."})
check("project: patched", s == 200 and out["project"]["logline"] == "A keeper waits.", f"{s}")

s, board = call("GET", f"/api/cinema/projects/{pid}")
check("storyboard: new project has one scene", s == 200 and len(board["scenes"]) == 1, f"{s}")
scene1 = board["scenes"][0]["id"]

# A reference image the member owns: make a quick picture, then upload it.
s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a weathered face"})
ref_id = None
if s == 200:
    jid = out["jobs"][0]["id"]
    for _ in range(60):
        _, j = call("GET", f"/api/jobs/{jid}")
        if j["job"]["status"] in ("succeeded", "failed"):
            break
        time.sleep(0.5)
    if j["job"]["assets"]:
        _, _, png = call("GET", j["job"]["assets"][0]["url"], raw=True)
        body, h = multipart("file", "face.png", png)
        s, up = call("POST", "/api/assets", body, headers=h)
        ref_id = up.get("asset", {}).get("id")
check("setup: reference image uploaded", ref_id is not None)

# --- cast and places --------------------------------------------------------------------
s, out = call("POST", f"/api/cinema/projects/{pid}/elements", {"kind": "monster", "name": "x"})
check("element: bad kind refused", s == 400, f"{s}")
s, out = call("POST", f"/api/cinema/projects/{pid}/elements", {"kind": "character", "name": "Ada", "refAssetIds": ["ast_nope"]})
check("element: unknown file refused", s == 404, f"{s}")
s, out = call("POST", f"/api/cinema/projects/{pid}/elements",
              {"kind": "character", "name": "Ada", "description": "an old keeper in a wool coat", "refAssetIds": [ref_id]})
ada = out.get("element", {})
check("element: character with reference", s == 200 and ada.get("refAssetIds") == [ref_id], f"{s} {str(out)[:120]}")
s, out = call("POST", f"/api/cinema/projects/{pid}/elements", {"kind": "location", "name": "The lamp room", "description": "glass walls, a huge lens"})
lamp = out.get("element", {})
s, out = call("POST", f"/api/cinema/projects/{pid}/elements", {"kind": "prop", "name": "Brass telescope"})
scope = out.get("element", {})
check("element: location and prop", lamp.get("kind") == "location" and scope.get("kind") == "prop")

# --- shots ------------------------------------------------------------------------------
s, out = call("POST", f"/api/cinema/scenes/{scene1}/shots", {"size": "huge"})
check("shot: unknown size refused", s == 400, f"{s}")
s, out = call("POST", f"/api/cinema/scenes/{scene1}/shots", {"duration": 500})
check("shot: silly duration refused", s == 400, f"{s}")
s, out = call("POST", f"/api/cinema/scenes/{scene1}/shots", {"castIds": [lamp["id"]]})
check("shot: a place as cast refused", s == 400, f"{s}")
shot_body = {"action": "Ada wipes the great lens and looks out to sea", "size": "close-up", "angle": "low", "movement": "push-in",
             "lens": "85mm", "focus": "shallow", "mood": "melancholy", "duration": 6, "sound": "Wind against glass",
             "castIds": [ada["id"], scope["id"]], "locationId": lamp["id"]}
s, out = call("POST", f"/api/cinema/scenes/{scene1}/shots", shot_body)
shot1 = out.get("shot", {})
check("shot: created with fields", s == 200 and shot1["size"] == "close-up" and shot1["castIds"] == [ada["id"], scope["id"]]
      and shot1["status"] == "empty", f"{s} {str(out)[:160]}")
s, out = call("POST", f"/api/cinema/scenes/{scene1}/shots", {"action": "The sea, empty to the horizon", "size": "extreme-wide", "duration": 4})
shot2 = out.get("shot", {})
s, out = call("POST", f"/api/cinema/scenes/{scene1}/shots", {"action": "A light that should [fail]", "duration": 3})
shot3 = out.get("shot", {})
check("shot: three in scene", shot2.get("position") == 1 and shot3.get("position") == 2, f"{shot2.get('position')} {shot3.get('position')}")

# --- composer, before a shot exists ---------------------------------------------------
anon = urllib.request.build_opener()


def anon_get(path):
    try:
        with anon.open(BASE + path, timeout=60) as res:
            return res.status, json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


s, d1 = anon_get("/api/cinema/compose?mode=still")
check("draft price: a still has a price signed out",
      s == 200 and d1.get("mode") == "still" and d1.get("modelId") and d1.get("price", {}).get("total", 0) > 0
      and d1["price"]["takes"] == 1 and d1.get("values", {}).get("aspect") == "16:9", f"{s} {str(d1)[:200]}")
s, d2 = anon_get("/api/cinema/compose?mode=still&count=3")
check("draft price: three takes cost three times one",
      s == 200 and d2.get("price", {}).get("takes") == 3 and d2["price"]["total"] == 3 * d1.get("price", {}).get("total", -1), f"{s} {str(d2.get('price'))}")
s, d3 = anon_get("/api/cinema/compose?mode=text&aspect=9:16&duration=8")
check("draft price: a text video has a price and its own model",
      s == 200 and d3.get("mode") == "text" and d3.get("modelId") != d1.get("modelId") and d3.get("price", {}).get("total", 0) > 0, f"{s} {str(d3)[:200]}")
s, d4 = anon_get("/api/cinema/compose?mode=text&duration=4")
check("draft price: a longer video never costs less",
      s == 200 and d3.get("price", {}).get("total", 0) >= d4.get("price", {}).get("total", 1), f"{d3.get('price')} {d4.get('price')}")
s, out = anon_get("/api/cinema/compose?mode=animate")
check("draft price: animate is refused, there is no still yet", s == 400 and err(out) == "invalid_request", f"{s} {err(out)}")
s, out = anon_get("/api/cinema/compose?mode=still&aspect=7:3")
check("draft price: unknown aspect refused", s == 400, f"{s}")
s, out = anon_get("/api/cinema/compose?mode=text&duration=900")
check("draft price: duration out of range refused", s == 400, f"{s}")
s, out = anon_get(f"/api/cinema/compose?mode=still&modelId={cat['models']['video'][0]['id']}")
check("draft price: a video model for a still is refused", s == 400, f"{s}")
s, out = call("GET", "/api/cinema/compose?mode=still")
check("draft price: the same for a member", s == 200 and out.get("price") == d1.get("price"), f"{s} {str(out.get('price'))}")

# --- composer -----------------------------------------------------------------------------
s, c1 = call("GET", f"/api/cinema/shots/{shot1['id']}/compose?mode=still")
s2, c2 = call("GET", f"/api/cinema/shots/{shot1['id']}/compose?mode=still")
p = c1.get("prompt", "")
check("compose: still prompt has framing, action, cast, place, look",
      s == 200 and p.startswith("Close-up from a low angle.") and "Ada wipes" in p and "Featuring Ada (an old keeper" in p
      and "Location: The lamp room" in p and "Look: shot on 35mm" in p and "Lighting: cool blue-hour" in p, p[:300])
check("compose: still leaves out movement and sound", "pushes in" not in p and "Sound:" not in p)
check("compose: same every time", c1 == c2)
check("compose: refs gathered, aspect from project",
      c1.get("inputs", {}).get("refs") == [ref_id] and c1.get("values", {}).get("aspect") == "16:9", str(c1.get("inputs")))
check("compose: price shown", c1.get("price", {}).get("total", 0) > 0, str(c1.get("price")))
s, out = call("GET", f"/api/cinema/shots/{shot1['id']}/compose?mode=animate")
check("compose: animate without still is refused", s == 409 and err(out) == "no_still", f"{s} {err(out)}")
s, out = call("GET", f"/api/cinema/shots/{shot1['id']}/compose?mode=text")
check("compose: text video has movement, sound and duration",
      s == 200 and "pushes in" in out["prompt"] and "Sound: Wind against glass." in out["prompt"] and str(out["values"].get("duration")) == "6",
      f"{s} {str(out)[:200]}")
s, out = call("GET", f"/api/cinema/shots/{shot1['id']}/compose?mode=dance")
check("compose: bad mode refused", s == 400, f"{s}")

# --- generate -----------------------------------------------------------------------------
s, out = call("POST", f"/api/cinema/shots/{shot1['id']}/takes", {"mode": "still", "count": 2})
takes = out.get("takes", [])
check("takes: two stills queued", s == 200 and len(takes) == 2 and all(t["status"] in ("queued", "running") for t in takes), f"{s} {str(out)[:200]}")
if takes:
    _, j = call("GET", f"/api/jobs/{takes[0]['jobId']}")
    job = j.get("job", {})
    check("takes: job carries surface and meta", job.get("surface") == "cinema" and job.get("meta", {}).get("shotId") == shot1["id"]
          and job.get("inputs", {}).get("refs") == [ref_id], str(job.get("meta")))
s, out = call("GET", f"/api/cinema/shots/{shot1['id']}")
check("shot: status generating", out.get("shot", {}).get("status") == "generating", out.get("shot", {}).get("status"))
sh = wait_shot(shot1["id"])
check("shot: ready with stills", sh.get("status") == "ready" and sh.get("hasStill") and sh["selectedTake"]["output"] == "image"
      and sh["selectedBy"] == "auto", f"{sh.get('status')}")
s, out = call("POST", f"/api/cinema/shots/{shot1['id']}/takes", {"mode": "still", "count": 9})
check("takes: count over 4 refused", s == 400, f"{s}")
s, out = call("POST", f"/api/cinema/shots/{shot1['id']}/takes", {"mode": "animate", "modelId": "flux-schnell"})
check("takes: animate on an image model refused", s == 400, f"{s}")

first_still = takes[0]["id"] if takes else ""
s, out = call("POST", f"/api/cinema/shots/{shot1['id']}/takes", {"mode": "animate", "fromTakeId": first_still})
anim = (out.get("takes") or [{}])[0]
check("takes: animate a still", s == 200 and anim.get("output") == "video" and anim.get("sourceTakeId") == first_still, f"{s} {str(out)[:200]}")
if anim.get("jobId"):
    _, j = call("GET", f"/api/jobs/{anim['jobId']}")
    check("takes: still is the start frame", j["job"]["inputs"].get("start") == [sh["takes"][0]["asset"]["id"]], str(j["job"]["inputs"]))
s, out = call("POST", f"/api/cinema/shots/{shot2['id']}/takes", {"mode": "text"})
check("takes: text to video", s == 200 and out["takes"][0]["mode"] == "text", f"{s} {str(out)[:200]}")
s, out = call("POST", f"/api/cinema/shots/{shot3['id']}/takes", {"mode": "still", "modelId": "flux-schnell"})
check("takes: failing still queued", s == 200, f"{s}")
sh = wait_shot(shot1["id"])
check("shot: video take selected automatically", sh.get("hasVideo") and sh["selectedTake"]["output"] == "video", f"{sh.get('selectedTake', {}).get('output')}")
s, out = call("PATCH", f"/api/cinema/shots/{shot1['id']}", {"selectedTakeId": first_still})
check("shot: member picks a take", s == 200 and out["shot"]["selectedTake"]["id"] == first_still and out["shot"]["selectedBy"] == "member", f"{s}")
s, out = call("PATCH", f"/api/cinema/shots/{shot1['id']}", {"selectedTakeId": "ctk_nope"})
check("shot: unknown take refused", s == 404, f"{s}")
s, out = call("PATCH", f"/api/cinema/shots/{shot1['id']}", {"selectedTakeId": anim.get("id")})
sh3 = wait_shot(shot3["id"])
check("shot: failure shows", sh3.get("status") == "failed" and sh3["takes"][0]["error"], f"{sh3.get('status')}")
sh2 = wait_shot(shot2["id"])
check("shot: text video ready", sh2.get("status") == "ready" and sh2.get("hasVideo"), f"{sh2.get('status')}")

# --- storyboard editing ---------------------------------------------------------------------
s, out = call("POST", f"/api/cinema/projects/{pid}/scenes", {"title": "The storm"})
scene2 = out.get("scene", {}).get("id")
check("scene: added", s == 200 and out["scene"]["position"] == 1, f"{s}")
s, out = call("PUT", f"/api/cinema/projects/{pid}/scenes/order", {"sceneIds": [scene2]})
check("scene order: incomplete list refused", s == 400, f"{s}")
s, out = call("PUT", f"/api/cinema/projects/{pid}/scenes/order", {"sceneIds": [scene2, scene1]})
check("scene order: changed", s == 200 and [x["id"] for x in out["scenes"]] == [scene2, scene1], f"{s}")
s, out = call("PUT", f"/api/cinema/scenes/{scene1}/shots/order", {"shotIds": [shot2["id"], shot1["id"], shot3["id"]]})
check("shot order: changed", s == 200 and [x["id"] for x in out["shots"]] == [shot2["id"], shot1["id"], shot3["id"]], f"{s}")
s, out = call("POST", f"/api/cinema/shots/{shot2['id']}/duplicate")
dup = out.get("shot", {})
check("shot: duplicated right after, without takes", s == 200 and dup["position"] == 1 and dup["takes"] == [] and dup["action"] == shot2["action"], f"{s}")
s, out = call("DELETE", f"/api/cinema/shots/{dup.get('id')}")
check("shot: deleted", s == 200, f"{s}")
s, out = call("POST", f"/api/cinema/scenes/{scene1}/duplicate")
check("scene: duplicated with shots", s == 200 and len(out["shots"]) == 3, f"{s}")
dup_scene = out.get("scene", {}).get("id")
s, out = call("DELETE", f"/api/cinema/scenes/{dup_scene}")
check("scene: deleted", s == 200, f"{s}")
for i in range(5):
    call("POST", f"/api/cinema/scenes/{scene2}/shots", {"action": f"Waves crash on the rocks, take {i}", "size": "wide", "duration": 2})

s, board = call("GET", f"/api/cinema/projects/{pid}")
summ = board.get("summary", {})
shots_all = [x for sc in board.get("scenes", []) for x in sc["shots"]]
check("storyboard: scenes, shots and running time",
      s == 200 and summ["sceneCount"] == 2 and summ["shotCount"] == 8 and summ["plannedSeconds"] == 6 + 4 + 3 + 10
      and summ["cutSeconds"] > 0 and shots_all[0]["number"] == "1.1", f"{s} {summ}")
check("storyboard: selected takes present", any(x["selectedTake"] for x in shots_all))

# --- batch: every missing still ---------------------------------------------------------------
s, out = call("GET", f"/api/cinema/projects/{pid}/batch?modelId=flux-schnell")
quote = out.get("quote", {})
check("batch: quote lists missing stills", s == 200 and quote["count"] == 7 and quote["total"] == sum(x["millicredits"] for x in quote["shots"]), f"{s} {quote.get('count')}")
s, out = call("POST", f"/api/cinema/projects/{pid}/batch", {"modelId": "flux-schnell", "expectedTotal": 1})
check("batch: price change refused", s == 409 and err(out) == "price_changed", f"{s} {err(out)}")
s, out = call("POST", f"/api/cinema/projects/{pid}/batch", {"modelId": "flux-schnell", "expectedTotal": quote["total"]})
batch = out.get("batch", {})
check("batch: started, rest waits for slots",
      s == 200 and batch["counts"]["total"] == 7 and batch["counts"]["waiting"] >= 3, f"{s} {batch.get('counts')}")
s, out = call("POST", f"/api/cinema/projects/{pid}/batch", {"modelId": "flux-schnell"})
check("batch: second run refused while running", s == 409, f"{s} {err(out)}")
most_active = 0
deadline = time.time() + 90
while time.time() < deadline:
    _, a = call("GET", "/api/jobs?status=active&limit=50")
    most_active = max(most_active, len(a.get("jobs", [])))
    _, out = call("GET", f"/api/cinema/batches/{batch.get('id')}")
    b = out.get("batch", {})
    if b.get("status") == "done" and b["counts"]["finished"] + b["counts"]["failed"] == b["counts"]["total"]:
        break
    time.sleep(0.5)
check("batch: finished, the [fail] shot failed", b.get("status") == "done" and b["counts"]["finished"] == 6 and b["counts"]["failed"] == 1, f"{b.get('status')} {b.get('counts')}")
check("batch: never above the plan's limit", 0 < most_active <= 4, f"most active {most_active}")
s, out = call("GET", f"/api/cinema/projects/{pid}/batch?modelId=flux-schnell")
check("batch: only the failed shot is still missing", s == 200 and [x["shotId"] for x in out["quote"]["shots"]] == [shot3["id"]]
      and out["batch"]["id"] == batch.get("id"), f"{s} {out.get('quote', {}).get('count')}")
s, out = call("POST", "/api/cinema/projects", {"title": "Empty"})
empty_pid = out.get("project", {}).get("id")
s, out = call("POST", f"/api/cinema/projects/{empty_pid}/batch", {})
check("batch: nothing to do on a project without shots", s == 409 and err(out) == "nothing_to_do", f"{s} {err(out)}")
s, out = call("DELETE", f"/api/cinema/batches/{batch.get('id')}")
check("batch: stopping a finished batch is harmless", s == 200 and out["batch"]["status"] == "done", f"{s}")

# --- export ---------------------------------------------------------------------------------------
s, h, payload = call("GET", f"/api/cinema/projects/{pid}/export?format=csv", raw=True)
lines = payload.decode().strip().split("\r\n")
check("export: csv shot list", s == 200 and "text/csv" in h.get("Content-Type", "") and lines[0].startswith('"Shot"') and len(lines) == 9, f"{s} {len(lines)}")
s, h, payload = call("GET", f"/api/cinema/projects/{pid}/export?format=json", raw=True)
data = json.loads(payload) if s == 200 else {}
check("export: json project", s == 200 and data.get("format") == "parallax-cinema" and len(data["scenes"]) == 2, f"{s}")
s, out = call("GET", f"/api/cinema/projects/{pid}/export?format=pdf")
check("export: unknown format refused", s == 400, f"{s}")
s, out = call("POST", f"/api/cinema/projects/{pid}/render")
if s == 501:
    check("render: clear message without ffmpeg", err(out) == "render_unavailable" and out["error"]["message"], str(out))
    cut = None
else:
    cut = out.get("asset", {})
    check("render: joined video saved", s == 200 and cut.get("kind") == "video" and out["shotsUsed"] == 2, f"{s} {str(out)[:200]}")
    st, _, _ = call("GET", cut.get("url", "/x"), raw=True)
    check("render: file readable", st == 200, f"{st}")

# --- another member ---------------------------------------------------------------------------------
mine = opener
opener = new_opener()
call("POST", "/api/auth/guest")
s, out = call("GET", f"/api/cinema/projects/{pid}")
check("privacy: other member cannot read the project", s == 404, f"{s}")
s, out = call("GET", "/api/cinema/projects")
check("privacy: other member's list is empty", s == 200 and out["projects"] == [], f"{s}")
s, out = call("PATCH", f"/api/cinema/shots/{shot1['id']}", {"action": "hijacked"})
check("privacy: other member cannot edit a shot", s == 404, f"{s}")
s, out = call("POST", f"/api/cinema/shots/{shot1['id']}/takes", {"mode": "still"})
check("privacy: other member cannot generate on a shot", s == 404, f"{s}")
s, out = call("GET", f"/api/cinema/takes/{first_still}")
check("privacy: other member cannot read a take", s == 404, f"{s}")
s, out = call("DELETE", f"/api/cinema/elements/{ada['id']}")
check("privacy: other member cannot delete an element", s == 404, f"{s}")
s, out = call("GET", f"/api/cinema/batches/{batch.get('id')}")
check("privacy: other member cannot read a batch", s == 404, f"{s}")
s, out = call("GET", f"/api/cinema/projects/{pid}/export?format=csv")
check("privacy: other member cannot export", s == 404, f"{s}")
s, out = call("POST", "/api/cinema/projects", {"title": "Mine"})
other_pid = out.get("project", {}).get("id")
s, out = call("POST", f"/api/cinema/projects/{other_pid}/elements", {"kind": "character", "name": "Thief", "refAssetIds": [ref_id]})
check("privacy: other member cannot use A's file as a reference", s == 404, f"{s}")
s, out = call("POST", f"/api/cinema/scenes/{scene1}/shots", {"action": "x"})
check("privacy: other member cannot add shots to A's scene", s == 404, f"{s}")
opener = mine
s, out = call("GET", f"/api/cinema/shots/{shot1['id']}")
check("privacy: A's shot unchanged", out["shot"]["action"] == shot_body["action"])

# --- clean up ---------------------------------------------------------------------------------------
s, out = call("DELETE", f"/api/cinema/takes/{first_still}")
check("take: removed from shot", s == 200, f"{s}")
s, out = call("DELETE", f"/api/cinema/elements/{scope['id']}")
s2, out2 = call("GET", f"/api/cinema/shots/{shot1['id']}")
check("element: delete takes it out of shots", s == 200 and out2["shot"]["castIds"] == [ada["id"]], f"{s}")
s, out = call("DELETE", f"/api/cinema/projects/{pid}")
s2, out2 = call("GET", f"/api/cinema/projects/{pid}")
check("project: deleted", s == 200 and s2 == 404, f"{s} {s2}")
if cut:
    st, _, _ = call("GET", cut["url"], raw=True)
    check("project: delete keeps library files", st == 200, f"{st}")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
