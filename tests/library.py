"""API test for the library: folders, listing, bulk actions, trash and elements. Usage: library.py <base-url>"""
import http.cookiejar
import json
import sys
import time
import urllib.error
import urllib.request
import uuid

BASE = sys.argv[1].rstrip("/")
results = []


class Member:
    """One browser: its own cookie jar."""

    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, method, path, body=None, headers=None, raw=False):
        data = None
        h = dict(headers or {})
        if body is not None and not isinstance(body, bytes):
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        elif body is not None:
            data = body
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
        try:
            with self.opener.open(req, timeout=60) as res:
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


def multipart(field, filename, content, extra=None):
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in (extra or {}).items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def generate(m, prompt, count, model="flux-schnell"):
    s, out = m.call("POST", "/api/jobs", {"modelId": model, "prompt": prompt, "count": count})
    ids = [j["id"] for j in out.get("jobs", [])]
    deadline = time.time() + 60
    jobs = []
    while time.time() < deadline:
        jobs = [m.call("GET", f"/api/jobs/{i}")[1].get("job", {}) for i in ids]
        if jobs and all(j.get("status") in ("succeeded", "failed", "canceled") for j in jobs):
            break
        time.sleep(0.5)
    return s, jobs, [a for j in jobs for a in j.get("assets", [])]


# --- signed out ------------------------------------------------------------------
anon = Member()
for method, path in [("GET", "/api/library"), ("GET", "/api/library/summary"), ("GET", "/api/folders"), ("GET", "/api/elements"),
                     ("GET", "/api/library/trash"), ("POST", "/api/library/bulk"), ("POST", "/api/folders"), ("POST", "/api/elements")]:
    s, out = anon.call(method, path, {} if method == "POST" else None)
    check(f"signed out: {method} {path} is 401", s == 401 and code(out) == "unauthorized", f"{s}")

a = Member()
s, g = a.call("POST", "/api/auth/guest")
check("member A: guest account", s == 200, f"{s}")

# --- some files ------------------------------------------------------------------
s, jobs, fox = generate(a, "a red fox in snow", 4)
check("setup: 4 fox images", len(fox) == 4, f"{s} {len(fox)}")
s, jobs, owl = generate(a, "an owl at night", 2)
check("setup: 2 owl images", len(owl) == 2, f"{s} {len(owl)}")
_, _, png = a.call("GET", fox[0]["url"], raw=True) if fox else (0, None, b"")
body, h = multipart("file", "my upload.png", png, {"accept": "image"})
s, up = a.call("POST", "/api/assets", body, headers=h)
upload = up.get("asset", {})
check("setup: upload", s == 200 and upload.get("source") == "upload", f"{s}")
all_ids = [x["id"] for x in fox + owl] + [upload.get("id")]

# --- listing ---------------------------------------------------------------------
s, out = a.call("GET", "/api/library")
check("list: all 7 files, newest first", s == 200 and [x["id"] for x in out["assets"]][:1] == [upload.get("id")] and len(out["assets"]) == 7, f"{s} {len(out.get('assets', []))}")
check("list: tab counts", out.get("counts") == {"all": 7, "image": 7, "video": 0, "audio": 0}, str(out.get("counts")))
s, out = a.call("GET", "/api/library?q=owl")
check("search: prompt text", s == 200 and len(out["assets"]) == 2 and out["counts"]["all"] == 2, f"{s} {len(out.get('assets', []))}")
s, out = a.call("GET", "/api/library?q=upload")
check("search: title text", s == 200 and [x["id"] for x in out["assets"]] == [upload.get("id")], f"{s}")
s, out = a.call("GET", "/api/library?q=%25")
check("search: % is literal", s == 200 and len(out["assets"]) == 0, f"{s} {len(out.get('assets', []))}")
s, out = a.call("GET", "/api/library?source=upload")
check("filter: source", s == 200 and len(out["assets"]) == 1, f"{s}")
s, out = a.call("GET", "/api/library?model=flux-schnell")
check("filter: model", s == 200 and len(out["assets"]) == 6, f"{s} {len(out.get('assets', []))}")
s, out = a.call("GET", "/api/library?kind=video")
check("filter: kind with no matches still counts other tabs", s == 200 and out["assets"] == [] and out["counts"]["image"] == 7, f"{s}")
future = int(time.time() * 1000) + 3_600_000
s, out = a.call("GET", f"/api/library?from={future}")
check("filter: date range", s == 200 and out["assets"] == [], f"{s}")
s, out = a.call("GET", "/api/library?kind=pdf")
check("bad input: unknown kind is 400", s == 400 and code(out) == "invalid_request", f"{s}")
s, out = a.call("GET", "/api/library?cursor=garbage")
check("bad input: bad cursor is 400", s == 400, f"{s}")

# Cursor paging on two sorts: no repeats, no gaps.
for sort in ("newest", "oldest", "largest", "title"):
    seen, cursor, pages = [], None, 0
    while pages < 10:
        s, out = a.call("GET", f"/api/library?limit=3&sort={sort}" + (f"&cursor={cursor}" if cursor else ""))
        if s != 200:
            break
        seen += [x["id"] for x in out["assets"]]
        cursor = out.get("nextCursor")
        pages += 1
        if not cursor:
            break
    check(f"paging: sort={sort} walks every file once", sorted(seen) == sorted(all_ids) and pages == 3, f"{len(seen)} in {pages} pages")

s, out = a.call("GET", "/api/library/summary")
total = sum(x["bytes"] for x in fox + owl) + upload.get("bytes", 0)
check("summary: counts and storage", s == 200 and out["counts"]["all"] == 7 and out["counts"]["uploads"] == 1 and out["storage"]["totalBytes"] == total
      and out["storage"]["byKind"]["image"] == total, f"{s} {str(out)[:200]}")
check("summary: models used", any(m["id"] == "flux-schnell" and m["count"] == 6 for m in out.get("models", [])), str(out.get("models")))

# --- folders ---------------------------------------------------------------------
s, out = a.call("POST", "/api/folders", {"name": "  Foxes  "})
folder = out.get("folder", {})
check("folder: create", s == 200 and folder.get("name") == "Foxes" and folder.get("count") == 0, f"{s} {out}")
s, out = a.call("POST", "/api/folders", {"name": "foxes"})
check("folder: duplicate name is 409", s == 409 and code(out) == "name_taken", f"{s}")
s, out = a.call("POST", "/api/folders", {"name": ""})
check("folder: empty name is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/folders", {"name": "x" * 81})
check("folder: long name is 400", s == 400, f"{s}")
s, out = a.call("POST", f"/api/folders/{folder.get('id')}/assets", {"ids": [x["id"] for x in fox]})
check("folder: move 4 in", s == 200 and out.get("moved") == 4, f"{s} {out}")
s, out = a.call("GET", "/api/folders")
check("folder: list with counts", s == 200 and out["folders"][0]["count"] == 4 and out["unfiled"] == 3, f"{s} {out}")
s, out = a.call("GET", f"/api/library?folder={folder.get('id')}")
check("filter: folder", s == 200 and len(out["assets"]) == 4, f"{s}")
s, out = a.call("GET", "/api/library?folder=none")
check("filter: no folder", s == 200 and len(out["assets"]) == 3, f"{s}")
s, out = a.call("PATCH", f"/api/folders/{folder.get('id')}", {"name": "Fox shots"})
check("folder: rename", s == 200 and out["folder"]["name"] == "Fox shots", f"{s}")
s, out = a.call("POST", f"/api/folders/{folder.get('id')}/assets", {"ids": [fox[0]["id"], "ast_nope"]})
check("folder: move with a bad id changes nothing", s == 404 and a.call("GET", "/api/folders")[1]["unfiled"] == 3, f"{s}")
s, out = a.call("POST", "/api/folders/none/assets", {"ids": [fox[3]["id"]]})
check("folder: move out", s == 200 and a.call("GET", f"/api/folders/{folder.get('id')}")[1]["folder"]["count"] == 3, f"{s}")

# --- bulk ------------------------------------------------------------------------
s, out = a.call("POST", "/api/library/bulk", {"action": "favorite", "favorite": True, "ids": [owl[0]["id"], owl[1]["id"]]})
check("bulk: favourite 2", s == 200 and out.get("count") == 2, f"{s} {out}")
s, out = a.call("GET", "/api/library?favorite=1")
check("filter: favourite", s == 200 and len(out["assets"]) == 2 and all(x["favorite"] for x in out["assets"]), f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "favorite", "favorite": False, "ids": [owl[0]["id"], "ast_nope"]})
check("bulk: all or nothing", s == 404 and len(a.call("GET", "/api/library?favorite=1")[1]["assets"]) == 2, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "favorite", "favorite": True, "ids": [f"ast_{i}" for i in range(201)]})
check("bulk: over 200 is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "explode", "ids": [owl[0]["id"]]})
check("bulk: unknown action is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "move", "folderId": folder.get("id"), "ids": [owl[0]["id"], owl[1]["id"]]})
check("bulk: move", s == 200 and a.call("GET", f"/api/folders/{folder.get('id')}")[1]["folder"]["count"] == 5, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "move", "folderId": None, "ids": [owl[1]["id"]]})
check("bulk: move out", s == 200 and a.call("GET", f"/api/folders/{folder.get('id')}")[1]["folder"]["count"] == 4, f"{s}")

# --- elements --------------------------------------------------------------------
s, out = a.call("POST", "/api/elements", {"type": "character", "name": "Rusty the fox", "description": "A red fox with a white tail tip.",
                                          "tags": ["Fox", "red", "fox"], "assetIds": [x["id"] for x in fox]})
el = out.get("element", {})
check("element: create", s == 200 and el.get("name") == "Rusty the fox" and el.get("tags") == ["fox", "red"] and el.get("assetIds") == [x["id"] for x in fox]
      and el.get("cover", {}).get("id") == fox[0]["id"] and el.get("useCount") == 0, f"{s} {str(out)[:200]}")
s, out = a.call("POST", "/api/elements", {"type": "place", "name": "Night forest", "assetIds": [owl[0]["id"]]})
el2 = out.get("element", {})
check("element: second", s == 200, f"{s}")
s, out = a.call("POST", "/api/elements", {"type": "vehicle", "name": "x", "assetIds": [owl[0]["id"]]})
check("element: bad type is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/elements", {"type": "style", "name": "x", "assetIds": []})
check("element: no images is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/elements", {"type": "style", "name": "x", "assetIds": ["ast_nope"]})
check("element: unknown image is 404", s == 404, f"{s}")
s, out = a.call("POST", "/api/elements", {"type": "style", "name": "", "assetIds": [owl[0]["id"]]})
check("element: empty name is 400", s == 400, f"{s}")
s, out = a.call("GET", "/api/elements?q=white%20tail")
check("element: search description", s == 200 and [e["id"] for e in out["elements"]] == [el.get("id")], f"{s}")
s, out = a.call("GET", "/api/elements?tag=red")
check("element: filter by tag", s == 200 and [e["id"] for e in out["elements"]] == [el.get("id")], f"{s}")
s, out = a.call("GET", "/api/elements?type=place")
check("element: filter by type, counts", s == 200 and [e["id"] for e in out["elements"]] == [el2.get("id")] and out["counts"]["all"] == 2 and out["counts"]["character"] == 1, f"{s} {out.get('counts')}")
s, out = a.call("PATCH", f"/api/elements/{el.get('id')}", {"name": "Rusty", "assetIds": [fox[2]["id"], fox[1]["id"], fox[0]["id"], fox[3]["id"]]})
check("element: edit name and order", s == 200 and out["element"]["name"] == "Rusty" and out["element"]["cover"]["id"] == fox[2]["id"], f"{s}")
s, out = a.call("PATCH", f"/api/elements/{el.get('id')}", {"assetIds": [fox[0]["id"]] * 13})
check("element: duplicates collapse but 13 is too many", s == 400, f"{s}")

s, out = a.call("POST", f"/api/elements/{el.get('id')}/resolve", {"modelId": "nano-banana-2-lite", "dryRun": True})
check("resolve: cut to slot max (3)", s == 200 and out.get("slot", {}).get("id") == "refs" and out.get("assetIds") == [fox[2]["id"], fox[1]["id"], fox[0]["id"]]
      and out.get("dropped") == [fox[3]["id"]] and out.get("inputs") == {"refs": out.get("assetIds")}, f"{s} {str(out)[:200]}")
check("resolve: dry run does not count", out.get("element", {}).get("useCount") == 0, str(out.get("element", {}).get("useCount")))
s, out = a.call("POST", f"/api/elements/{el.get('id')}/resolve", {"modelId": "nano-banana-2-lite"})
check("resolve: counts a use", s == 200 and out["element"]["useCount"] == 1 and out["element"]["lastUsedAt"], f"{s}")
s, jobs = a.call("POST", "/api/jobs", {"modelId": "nano-banana-2-lite", "prompt": "the fox reading a book", "inputs": out.get("inputs")})
check("resolve: ids are accepted by the generator", s == 200 and jobs.get("jobs"), f"{s} {str(jobs)[:160]}")
s, out = a.call("POST", f"/api/elements/{el.get('id')}/resolve", {"modelId": "flux-schnell"})
check("resolve: model without reference slot is 409", s == 409 and code(out) == "no_reference_slot", f"{s} {out}")
s, out = a.call("POST", f"/api/elements/{el.get('id')}/resolve", {"modelId": "no-such-model"})
check("resolve: unknown model is 400", s == 400, f"{s}")
s, out = a.call("GET", "/api/elements?sort=used")
check("element: sort by last used", s == 200 and out["elements"][0]["id"] == el.get("id"), f"{s}")

# --- trash -----------------------------------------------------------------------
s, out = a.call("POST", "/api/library/bulk", {"action": "trash", "ids": [fox[2]["id"], fox[1]["id"]]})
check("trash: move 2", s == 200 and out.get("count") == 2, f"{s} {out}")
s, out = a.call("GET", "/api/library")
check("trash: gone from the library", s == 200 and len(out["assets"]) == 5, f"{s} {len(out.get('assets', []))}")
s, out = a.call("GET", f"/api/assets/{fox[2]['id']}")
check("trash: core asset read says 404", s == 404, f"{s}")
s, out = a.call("GET", "/api/library/trash")
check("trash: listed", s == 200 and out.get("count") == 2 and len(out["assets"]) == 2 and out["assets"][0].get("expiresAt", 0) > out["assets"][0].get("trashedAt", 0)
      and out.get("retentionDays") == 30, f"{s} {str(out)[:200]}")
trash_url = out["assets"][0]["trashUrl"] if out.get("assets") else "/"
s, hdrs, payload = a.call("GET", trash_url, raw=True)
check("trash: preview serves", s == 200 and payload[:4] == b"\x89PNG", f"{s}")
s, out = a.call("GET", f"/api/elements/{el.get('id')}")
check("trash: element hides trashed images", s == 200 and out["element"]["assetIds"] == [fox[0]["id"], fox[3]["id"]], f"{s} {out.get('element', {}).get('assetIds')}")
s, out = a.call("GET", "/api/library/summary")
check("trash: summary counts", s == 200 and out["counts"]["trash"] == 2 and out["counts"]["all"] == 5, f"{s}")
s, out = a.call("POST", "/api/library/trash/restore", {"ids": [fox[2]["id"]]})
check("trash: restore one", s == 200 and out.get("restored") == 1, f"{s} {out}")
s, out = a.call("GET", f"/api/elements/{el.get('id')}")
check("trash: restored image is back in the element, in place", out.get("element", {}).get("cover", {}).get("id") == fox[2]["id"], str(out.get("element", {}).get("assetIds")))
s, out = a.call("POST", "/api/library/trash/restore", {"ids": [fox[0]["id"]]})
check("trash: restoring a live file is 404", s == 404, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "delete", "ids": [fox[1]["id"]]})
check("trash: delete for good", s == 200 and out.get("count") == 1, f"{s} {out}")
s, hdrs, payload = a.call("GET", f"/api/library/trash/{fox[1]['id']}/file", raw=True)
check("trash: deleted file no longer serves", s == 404, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "restore", "ids": [fox[1]["id"]]})
check("trash: cannot restore a file deleted for good", s == 404, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "trash", "ids": [owl[1]["id"], upload.get("id")]})
s, out = a.call("DELETE", "/api/library/trash")
check("trash: empty", s == 200 and out.get("deleted") == 2 and a.call("GET", "/api/library/trash")[1]["count"] == 0, f"{s} {out}")
s, out = a.call("POST", "/api/library/bulk", {"action": "trash", "ids": [fox[3]["id"]]})
s, out = a.call("POST", "/api/library/trash/restore", {"all": True})
check("trash: restore all", s == 200 and out.get("restored") == 1, f"{s} {out}")

# --- folder delete sends files back to "no folder" ----------------------------------
before = a.call("GET", "/api/folders")[1]
s, out = a.call("DELETE", f"/api/folders/{folder.get('id')}")
after = a.call("GET", "/api/folders")[1]
check("folder: delete keeps the files", s == 200 and after["folders"] == [] and after["unfiled"] == before["unfiled"] + before["folders"][0]["count"], f"{s} {out}")
s, out = a.call("GET", f"/api/folders/{folder.get('id')}")
check("folder: deleted folder is 404", s == 404, f"{s}")

# --- another member ----------------------------------------------------------------
b = Member()
b.call("POST", "/api/auth/guest")
s, out = b.call("GET", "/api/library")
check("member B: empty library", s == 200 and out["assets"] == [] and out["counts"]["all"] == 0, f"{s}")
s, out = b.call("POST", "/api/folders", {"name": "Mine"})
b_folder = out.get("folder", {}).get("id")
s, out = b.call("GET", f"/api/elements/{el.get('id')}")
check("member B: cannot read A's element", s == 404, f"{s}")
s, out = b.call("PATCH", f"/api/elements/{el.get('id')}", {"name": "renamed by someone else"})
check("member B: cannot edit A's element", s == 404, f"{s}")
s, out = b.call("POST", f"/api/elements/{el.get('id')}/resolve", {"modelId": "nano-banana-2-lite"})
check("member B: cannot resolve A's element", s == 404, f"{s}")
s, out = b.call("POST", "/api/elements", {"type": "character", "name": "x", "assetIds": [fox[0]["id"]]})
check("member B: cannot build an element from A's file", s == 404, f"{s}")
s, out = b.call("POST", "/api/library/bulk", {"action": "trash", "ids": [fox[0]["id"]]})
check("member B: cannot trash A's file", s == 404, f"{s}")
s, out = b.call("POST", "/api/library/bulk", {"action": "delete", "ids": [fox[0]["id"]]})
check("member B: cannot delete A's file", s == 404, f"{s}")
s, out = b.call("POST", f"/api/folders/{b_folder}/assets", {"ids": [fox[0]["id"]]})
check("member B: cannot move A's file into own folder", s == 404, f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "trash", "ids": [owl[0]["id"]]})
s, out = b.call("GET", f"/api/library/trash/{owl[0]['id']}/file")
check("member B: cannot see A's trash", s == 404, f"{s}")
s, out = b.call("POST", "/api/library/trash/restore", {"ids": [owl[0]["id"]]})
check("member B: cannot restore A's trash", s == 404, f"{s}")
s, out = b.call("PATCH", f"/api/folders/{a.call('POST', '/api/folders', {'name': 'A only'})[1]['folder']['id']}", {"name": "x"})
check("member B: cannot rename A's folder", s == 404, f"{s}")
s, out = a.call("GET", f"/api/elements/{el.get('id')}")
check("member A: element untouched", s == 200 and out["element"]["name"] == "Rusty", f"{s}")
s, out = a.call("POST", "/api/library/bulk", {"action": "trash", "ids": [fox[0]["id"]]}, headers={"Origin": "https://evil.example"})
check("cross-site bulk refused", s == 403, f"{s}")

s, out = a.call("DELETE", f"/api/elements/{el2.get('id')}")
check("element: delete", s == 200 and a.call("GET", f"/api/elements/{el2.get('id')}")[0] == 404, f"{s}")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
