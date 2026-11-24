"""Ads studio API test in mock mode. Usage: ads.py <base-url>"""
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
        with opener.open(req, timeout=60) as res:
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
    return (out.get("error") or {}).get("code", "")


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


def wait_campaign(cid, seconds=150):
    deadline = time.time() + seconds
    out = {}
    while time.time() < deadline:
        _, out = call("GET", f"/api/ads/campaigns/{cid}")
        if out.get("campaign", {}).get("status") == "done":
            break
        time.sleep(1)
    return out.get("campaign", {})


def multipart(field, filename, content):
    boundary = uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n").encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def items_of(c):
    return [it for g in c.get("groups", []) for it in g["items"]]


def balance():
    return call("GET", "/api/wallet")[1].get("balance")


# --- catalog and signed-out access ------------------------------------------------
s, out = call("GET", "/api/ads/formats")
formats = {f["id"]: f for f in out.get("formats", [])}
check("formats: public catalog", s == 200 and len(formats) >= 8 and out.get("copyWriter") == "template", f"{s} {len(formats)}")
check("formats: every format valid and priced", formats and all(f["available"] and isinstance(f["pricePerAd"], int) and f["pricePerAd"] > 0 for f in formats.values()),
      str([(k, f["available"], f["pricePerAd"]) for k, f in formats.items()]))
check("formats: covers image, video and spoken", {f["group"] for f in formats.values()} == {"image", "video", "spoken"})
for path in ("/api/ads/brands", "/api/ads/products", "/api/ads/campaigns"):
    s, out = call("GET", path)
    check(f"signed out: {path} refused", s == 401 and err(out) == "unauthorized", f"{s}")

# --- member A ------------------------------------------------------------------------
call("POST", "/api/auth/guest")
s, out = call("POST", "/api/wallet/topup", {"packId": "pack-500"})
check("setup: demo top-up", s == 200, f"{s}")

s, out = call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a glass bottle on a table", "count": 1})
done = wait_jobs([j["id"] for j in out.get("jobs", [])])
png = call("GET", done[0]["assets"][0]["url"], raw=True)[1] if done and done[0].get("assets") else b""
ids = []
for name in ("product.png", "presenter.png"):
    body, h = multipart("file", name, png)
    s, up = call("POST", "/api/assets", body, headers=h)
    ids.append(up.get("asset", {}).get("id"))
image_id, presenter_id = ids
check("setup: uploaded product and presenter images", image_id and presenter_id, str(ids))

s, out = call("POST", "/api/ads/brands", {"name": "x", "colors": ["blue"]}, headers={"Origin": "https://evil.example"})
check("cross-site write refused", s == 403, f"{s}")

# --- brand kits ------------------------------------------------------------------------
s, out = call("POST", "/api/ads/brands", {"tone": "calm"})
check("brand: name required", s == 400 and err(out) == "invalid_request", f"{s} {out}")
s, out = call("POST", "/api/ads/brands", {"name": "Oak & Ember", "colors": ["blue"]})
check("brand: bad colour refused", s == 400, f"{s}")
s, out = call("POST", "/api/ads/brands", {"name": "Oak & Ember", "logoAssetId": "ast_doesnotexist"})
check("brand: unknown logo refused", s == 404, f"{s}")
s, out = call("POST", "/api/ads/brands", {
    "name": "Oak & Ember", "colors": [{"name": "Ember", "hex": "#c2410c"}, "#1f2937"], "fonts": {"heading": "Fraunces", "body": "Inter"},
    "tone": "Warm and playful", "logoAssetId": image_id, "wordsToUse": ["handmade", "small batch"], "wordsToAvoid": ["cheap"]})
kit = out.get("brandKit", {})
check("brand: created", s == 200 and kit.get("id") and kit["colors"][0] == {"name": "Ember", "hex": "#C2410C"} and kit["logo"]["assetId"] == image_id, f"{s} {str(out)[:200]}")
s, out = call("PATCH", f"/api/ads/brands/{kit.get('id')}", {"tone": "Bold and confident"})
check("brand: patch changes only what is sent", s == 200 and out["brandKit"]["tone"] == "Bold and confident" and out["brandKit"]["name"] == "Oak & Ember", f"{s}")
s, out = call("GET", "/api/ads/brands")
check("brand: listed", s == 200 and len(out.get("brandKits", [])) == 1)

# --- products ----------------------------------------------------------------------------
s, out = call("POST", "/api/ads/products", {"description": "no name"})
check("product: name required", s == 400, f"{s}")
s, out = call("POST", "/api/ads/products", {"name": "Candle", "link": "javascript:alert(1)"})
check("product: bad link refused", s == 400, f"{s}")
s, out = call("POST", "/api/ads/products", {"name": "Candle", "benefits": "not a list"})
check("product: benefits must be a list", s == 400, f"{s}")
s, out = call("POST", "/api/ads/products", {
    "name": "Ember Candle", "description": "A soy candle that smells like a campfire", "benefits": ["burns for 60 hours", "cheap to refill", "clean soy wax"],
    "audience": "people who love slow evenings", "price": "$24", "link": "https://example.com/candle", "imageIds": [image_id], "brandKitId": kit.get("id")})
product = out.get("product", {})
check("product: created", s == 200 and product.get("id") and product["images"][0]["assetId"] == image_id and product["brandKitId"] == kit.get("id"), f"{s} {str(out)[:200]}")

# --- copy ---------------------------------------------------------------------------------
s, out = call("POST", "/api/ads/copy", {"productId": product.get("id"), "count": 4})
copy = out.get("copy", [])
check("copy: template writer", s == 200 and out.get("writer") == "template" and len(copy) == 4 and all(c["headline"] and c["caption"] and c["cta"] for c in copy), f"{s} {str(out)[:200]}")
check("copy: variations differ", len({c["headline"] for c in copy}) > 1)
blob = json.dumps(out).lower()
check("copy: avoids the brand's avoided words", "cheap" not in blob, blob[:200])
check("copy: script names the product", "Ember Candle" in out.get("script", ""), out.get("script", "")[:120])
s, out = call("POST", "/api/ads/copy", {"productId": product.get("id"), "count": 50})
check("copy: count limited", s == 400, f"{s}")

# --- campaigns: validation ----------------------------------------------------------------
s, out = call("POST", "/api/ads/campaigns", {"productId": product.get("id"), "formats": ["nope"]})
check("campaign: unknown format refused", s == 400, f"{s}")
s, out = call("POST", "/api/ads/campaigns", {"productId": product.get("id"), "formats": ["hero-shot"], "variations": 9})
check("campaign: too many variations refused", s == 400, f"{s}")
s, out = call("POST", "/api/ads/campaigns", {"formats": ["hero-shot"]})
check("campaign: product required", s == 400, f"{s}")
s, out = call("POST", "/api/ads/campaigns", {"productId": product.get("id"), "formats": ["spokesperson"]})
nop = out.get("campaign", {}).get("id")
s, out = call("GET", f"/api/ads/campaigns/{nop}/quote")
check("campaign: spokesperson needs a presenter", s == 400 and "presenter" in out.get("error", {}).get("message", "").lower(), f"{s} {out}")
call("DELETE", f"/api/ads/campaigns/{nop}")

# --- campaigns: price, run, queue ------------------------------------------------------------
fmts = ["hero-shot", "unboxing", "voiceover", "spokesperson"]
s, out = call("POST", "/api/ads/campaigns", {"name": "Autumn launch", "productId": product.get("id"), "brandKitId": kit.get("id"),
                                             "formats": fmts, "variations": 2, "presenterAssetId": presenter_id})
camp = out.get("campaign", {})
cid = camp.get("id")
check("campaign: draft created", s == 200 and camp.get("status") == "draft" and camp["formats"] == fmts and camp["variations"] == 2, f"{s} {str(out)[:200]}")
s, out = call("GET", f"/api/ads/campaigns/{cid}/quote")
quote = out.get("quote", {})
check("campaign: quote", s == 200 and quote.get("ads") == 8 and quote.get("total") == sum(f["subtotal"] for f in quote["formats"]) and quote.get("enough"), f"{s} {str(out)[:300]}")
hero_quote = next((f for f in quote.get("formats", []) if f["formatId"] == "hero-shot"), {})
check("campaign: image price matches catalog", hero_quote.get("subtotal") == 2 * formats["hero-shot"]["pricePerAd"], str(hero_quote))

before = balance()
s, out = call("POST", f"/api/ads/campaigns/{cid}/run", {"expectedCost": quote.get("total", 0) + 100})
check("run: stale price refused", s == 409 and err(out) == "price_changed", f"{s} {out}")
s, out = call("POST", f"/api/ads/campaigns/{cid}/run", {"expectedCost": quote.get("total")})
camp = out.get("campaign", {})
its = items_of(camp)
running = [i for i in its if i["status"] == "running"]
waiting = [i for i in its if i["status"] == "waiting"]
check("run: started", s == 200 and camp.get("status") == "running" and len(its) == 8, f"{s} {str(out)[:300]}")
check("run: respects the limit on jobs at once", 0 < len(running) <= 4 and len(waiting) >= 4, f"running={len(running)} waiting={len(waiting)}")
s, out = call("POST", f"/api/ads/campaigns/{cid}/run", {})
check("run: second run refused", s == 409 and err(out) == "already_ran", f"{s}")

camp = wait_campaign(cid)
its = items_of(camp)
check("run: every ad finished", camp.get("status") == "done" and all(i["status"] == "succeeded" for i in its), str([(i["formatId"], i["status"], i.get("error")) for i in its]))
check("run: grouped by format in campaign order", [g["format"]["id"] for g in camp.get("groups", [])] == fmts)
hero = camp["groups"][0]["items"] if camp.get("groups") else []
check("run: hero shots are images with copy", hero and all(i["assets"] and i["assets"][0]["kind"] == "image" and i["copy"]["headline"] for i in hero), str(hero)[:200])
check("run: hero uses the product image", hero and hero[0]["job"]["inputs"].get("refs") == [image_id], str(hero[0]["job"]["inputs"]) if hero else "")
check("run: jobs carry surface and meta", hero and hero[0]["job"]["surface"] == "ads" and hero[0]["job"]["meta"].get("campaignId") == cid, str(hero[0]["job"]["meta"]) if hero else "")
check("run: variations use different prompts", len({i["prompt"] for i in hero}) == 2)
talk = camp["groups"][3]["items"] if len(camp.get("groups", [])) > 3 else []
check("spoken: talking video made from the speech", talk and talk[0]["speechJob"]["status"] == "succeeded" and talk[0]["job"]["modelId"] == "heygen-avatar-iv"
      and talk[0]["job"]["inputs"].get("voice") == [talk[0]["speechJob"]["assets"][0]["id"]] and talk[0]["job"]["inputs"].get("portrait") == [presenter_id]
      and talk[0]["assets"][0]["kind"] == "video", str(talk[0])[:300] if talk else "")
voice = camp["groups"][2]["items"] if len(camp.get("groups", [])) > 2 else []
check("spoken: audio spot", voice and voice[0]["assets"][0]["kind"] == "audio" and voice[0]["script"], str(voice[0])[:200] if voice else "")
check("run: charged exactly the quote", balance() == before - quote.get("total", 0), f"before={before} after={balance()} quote={quote.get('total')}")

# --- winners, re-run, duplicate -----------------------------------------------------------------
s, out = call("PATCH", f"/api/ads/items/{hero[0]['id']}", {"winner": True})
check("winner: marked", s == 200 and out["item"]["winner"] is True, f"{s}")
s, out = call("PATCH", f"/api/ads/items/{hero[0]['id']}", {"winner": "yes"})
check("winner: bad value refused", s == 400, f"{s}")
s, out = call("GET", "/api/ads/campaigns")
row = next((c for c in out.get("campaigns", []) if c["id"] == cid), {})
check("list: counts and cover", s == 200 and row.get("counts", {}).get("winners") == 1 and row.get("cover") and row["cover"]["assetId"] == hero[0]["assets"][0]["id"], str(row)[:300])

s, out = call("GET", f"/api/ads/campaigns/{cid}/quote?formatId=hero-shot")
rq = out.get("quote", {})
check("rerun: quote for one format", s == 200 and rq.get("ads") == 2, f"{s} {out}")
s, out = call("POST", f"/api/ads/campaigns/{cid}/rerun", {"formatId": "hero-shot", "expectedCost": rq.get("total")})
check("rerun: started", s == 200 and out["campaign"]["status"] == "running", f"{s} {str(out)[:200]}")
camp = wait_campaign(cid)
hero2 = camp["groups"][0]["items"]
check("rerun: new round added, old kept", len(hero2) == 4 and {i["round"] for i in hero2} == {1, 2} and sum(i["winner"] for i in hero2) == 1, str([(i["round"], i["status"]) for i in hero2]))
check("rerun: new round has fresh prompts", not ({i["prompt"] for i in hero2 if i["round"] == 2} & {i["prompt"] for i in hero2 if i["round"] == 1}))
s, out = call("POST", f"/api/ads/campaigns/{cid}/rerun", {"formatId": "web-banner"})
check("rerun: format not in campaign refused", s == 400, f"{s}")

s, out = call("POST", f"/api/ads/campaigns/{cid}/duplicate")
dup = out.get("campaign", {})
check("duplicate: new draft with same settings", s == 200 and dup.get("id") != cid and dup.get("status") == "draft" and dup.get("formats") == fmts and dup.get("copiedFrom") == cid, f"{s} {str(out)[:200]}")

# --- failure path: the mock fails, credits come back ------------------------------------------------
s, out = call("POST", "/api/ads/products", {"name": "Broken [fail] lamp"})
bad_product = out.get("product", {}).get("id")
s, out = call("POST", "/api/ads/campaigns", {"productId": bad_product, "formats": ["hero-shot"], "variations": 1})
fid = out.get("campaign", {}).get("id")
before = balance()
s, out = call("POST", f"/api/ads/campaigns/{fid}/run", {})
camp = wait_campaign(fid, 60)
fi = items_of(camp)
check("failure: ad marked failed with a message", fi and fi[0]["status"] == "failed" and fi[0]["error"]["message"], str(fi)[:200])
check("failure: credits returned", balance() == before, f"{before} -> {balance()}")
s, out = call("PATCH", f"/api/ads/items/{fi[0]['id']}", {"winner": True}) if fi else (0, {})
check("failure: a failed ad cannot win", s == 409, f"{s}")

# --- member B cannot reach member A's things -----------------------------------------------------------
mine, opener = opener, new_opener()
call("POST", "/api/auth/guest")
for path in (f"/api/ads/campaigns/{cid}", f"/api/ads/brands/{kit.get('id')}", f"/api/ads/products/{product.get('id')}", f"/api/ads/campaigns/{cid}/quote"):
    s, out = call("GET", path)
    check(f"privacy: B cannot read {path.split('/')[3]}", s == 404, f"{s}")
s, out = call("PATCH", f"/api/ads/items/{hero[0]['id']}", {"winner": False})
check("privacy: B cannot mark A's winner", s == 404, f"{s}")
s, out = call("POST", f"/api/ads/campaigns/{cid}/rerun", {"formatId": "hero-shot"})
check("privacy: B cannot re-run A's campaign", s == 404, f"{s}")
s, out = call("POST", f"/api/ads/campaigns/{cid}/duplicate")
check("privacy: B cannot duplicate A's campaign", s == 404, f"{s}")
s, out = call("POST", "/api/ads/campaigns", {"productId": product.get("id"), "formats": ["hero-shot"]})
check("privacy: B cannot use A's product", s == 404, f"{s}")
s, out = call("POST", "/api/ads/products", {"name": "Mine", "imageIds": [image_id]})
check("privacy: B cannot use A's image", s == 404, f"{s}")
s, out = call("DELETE", f"/api/ads/campaigns/{cid}")
check("privacy: B cannot delete A's campaign", s == 404, f"{s}")
s, out = call("GET", "/api/ads/campaigns")
check("privacy: B's list is empty", s == 200 and out.get("campaigns") == [], f"{s}")
opener = mine

# --- delete ---------------------------------------------------------------------------------------
s, out = call("DELETE", f"/api/ads/campaigns/{dup.get('id')}")
s2, _ = call("GET", f"/api/ads/campaigns/{dup.get('id')}")
check("delete: campaign gone", s == 200 and s2 == 404, f"{s} {s2}")
s, out = call("DELETE", f"/api/ads/brands/{kit.get('id')}")
s2, p = call("GET", f"/api/ads/products/{product.get('id')}")
check("delete: brand kit gone, product kept without it", s == 200 and s2 == 200 and p["product"]["brandKitId"] is None, f"{s} {s2}")

passed = sum(results)
print(f"\n{passed}/{len(results)} checks passed")
sys.exit(0 if passed == len(results) else 1)
