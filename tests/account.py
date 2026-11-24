"""Account, plans and billing API in mock mode. Usage: account.py <base-url>"""
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


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def code(out):
    return out.get("error", {}).get("code")


def signup(m, password="correct horse battery"):
    email = f"acct-{uuid.uuid4().hex[:8]}@example.com"
    s, out = m.call("POST", "/api/auth/signup", {"email": email, "password": password, "name": "Test Maker"})
    return s, out, email


def balance(m):
    return m.call("GET", "/api/account")[1].get("balance")


anon = Member()
for _ in range(90):
    try:
        if anon.call("GET", "/api/auth/me")[0] == 200:
            break
    except Exception:
        pass
    time.sleep(1)

# --- signed out ------------------------------------------------------------------------
s, _ = anon.call("GET", "/api/account")
check("signed out: account is 401", s == 401, f"{s}")
s, _ = anon.call("POST", "/api/billing/subscription", {"planId": "plus"})
check("signed out: plan change is 401", s == 401, f"{s}")
s, out = anon.call("GET", "/api/billing/plans")
ids = [p["id"] for p in out.get("plans", [])]
check("plans: public catalog", s == 200 and ids == ["free", "plus", "pro", "studio"] and out.get("current") is None, f"{s} {ids}")
plus = next((p for p in out.get("plans", []) if p["id"] == "plus"), {})
check("plans: prices and credits", plus.get("priceMonthCents") == 1900 and plus.get("priceYearCents", 0) < 1900 * 12 and plus.get("monthlyCredits") == 400 and plus.get("features"), str(plus)[:160])

# --- profile ---------------------------------------------------------------------------
a, b = Member(), Member()
s, out, a_email = signup(a)
check("member A signs up", s == 200, f"{s}")
s, out, b_email = signup(b)
check("member B signs up", s == 200, f"{s}")
s, acct = a.call("GET", "/api/account")
check("account: overview", s == 200 and acct["user"]["email"] == a_email and acct["subscription"]["status"] == "free" and acct["preferences"]["theme"] == "system", f"{s} {str(acct)[:160]}")
a_handle = f"maker{uuid.uuid4().hex[:6]}"
s, out = a.call("PATCH", "/api/account/profile", {"name": "  Ada   Maker ", "bio": "I make short films.", "handle": a_handle.upper()})
check("profile: update name, bio, handle", s == 200 and out["user"]["name"] == "Ada Maker" and out["user"]["handle"] == a_handle and out["user"]["bio"] == "I make short films.", f"{s} {str(out)[:160]}")
s, out = b.call("PATCH", "/api/account/profile", {"handle": a_handle})
check("profile: handle taken is 409", s == 409 and code(out) == "handle_taken", f"{s} {code(out)}")
s, out = a.call("PATCH", "/api/account/profile", {"handle": "a!"})
check("profile: bad handle is 400", s == 400, f"{s}")
s, out = a.call("PATCH", "/api/account/profile", {"handle": "admin"})
check("profile: reserved handle refused", s == 409, f"{s}")
s, out = a.call("PATCH", "/api/account/profile", {"name": 42})
check("profile: wrong type is 400", s == 400, f"{s}")
s, out = a.call("PATCH", "/api/account/profile", {"bio": "x" * 301})
check("profile: long bio is 400", s == 400, f"{s}")
s, out = b.call("GET", f"/api/account/handle?handle={a_handle}")
check("handle check: taken", s == 200 and out["available"] is False, str(out))
s, out = b.call("GET", f"/api/account/handle?handle=free-{uuid.uuid4().hex[:6]}")
check("handle check: free", s == 200 and out["available"] is True, str(out))

# A generation, for the avatar and the usage numbers.
before_job = balance(a)
s, out = a.call("POST", "/api/jobs", {"modelId": "flux-schnell", "prompt": "a lighthouse at dusk"})
job = (out.get("jobs") or [{}])[0]
for _ in range(120):
    s, j = a.call("GET", f"/api/jobs/{job.get('id')}")
    if j.get("job", {}).get("status") in ("succeeded", "failed", "canceled"):
        break
    time.sleep(0.5)
asset = (j.get("job", {}).get("assets") or [{}])[0]
check("setup: one generated image", j.get("job", {}).get("status") == "succeeded" and asset.get("kind") == "image", str(j)[:160])
s, out = a.call("PATCH", "/api/account/profile", {"avatarAssetId": asset.get("id")})
check("profile: own image as avatar", s == 200 and out["user"]["avatarUrl"] == f"/api/assets/{asset.get('id')}/file", f"{s} {str(out)[:120]}")
s, out = b.call("PATCH", "/api/account/profile", {"avatarAssetId": asset.get("id")})
check("privacy: someone else's image as avatar is 404", s == 404, f"{s}")
avatar_file = f"/api/assets/{asset.get('id')}/file"
check("profile: other members can load the avatar", b.call("GET", avatar_file)[0] == 200 and Member().call("GET", avatar_file)[0] == 200)
s, out = a.call("PATCH", "/api/account/profile", {"avatarAssetId": None})
check("profile: clear avatar", s == 200 and out["user"]["avatarUrl"] is None, f"{s}")
check("privacy: a cleared avatar is private again", b.call("GET", avatar_file)[0] == 404 and a.call("GET", avatar_file)[0] == 200)

# --- preferences -----------------------------------------------------------------------
s, out = a.call("PATCH", "/api/account/preferences", {"theme": "dark", "defaultPrivacy": "public", "notices": {"productNews": True}})
p = out.get("preferences", {})
check("prefs: update and merge notices", s == 200 and p.get("theme") == "dark" and p.get("defaultPrivacy") == "public" and p["notices"]["productNews"] is True and p["notices"]["jobFinished"] is True, str(out)[:200])
s, out = a.call("PATCH", "/api/account/preferences", {"theme": "neon"})
check("prefs: bad value is 400", s == 400, f"{s}")
s, out = a.call("PATCH", "/api/account/preferences", {"favouriteColour": "red"})
check("prefs: unknown key is 400", s == 400, f"{s}")
s, out = b.call("GET", "/api/account/preferences")
check("privacy: B sees own defaults, not A's", s == 200 and out["preferences"]["theme"] == "system", str(out)[:120])

# --- plans -----------------------------------------------------------------------------
start = balance(a)
s, out = a.call("POST", "/api/billing/subscription", {"planId": "gold"})
check("plan: unknown plan is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/billing/subscription", {"planId": "plus", "interval": "weekly"})
check("plan: bad interval is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/billing/subscription/cancel")
check("plan: cancel on Free is 409", s == 409, f"{s}")
s, out = a.call("POST", "/api/billing/subscription", {"planId": "plus", "interval": "month"})
sub = out.get("subscription", {})
check("plan: subscribe to Plus monthly", s == 200 and out.get("effective") == "now" and sub.get("planId") == "plus" and sub.get("status") == "active" and out.get("receiptId"), f"{s} {str(out)[:200]}")
check("credits: Plus month granted once", out.get("balance") == start + 400000, f"{start} -> {out.get('balance')}")
for _ in range(3):
    a.call("GET", "/api/billing/subscription")
    a.call("GET", "/api/account")
check("credits: repeated reads do not grant again", balance(a) == start + 400000, f"{balance(a)}")
s, out = a.call("GET", "/api/auth/me")
check("plan: users.plan follows", out["user"]["plan"] == "plus", out["user"]["plan"])
s, out = a.call("POST", "/api/billing/subscription", {"planId": "plus", "interval": "month"})
check("plan: same plan again is 409", s == 409 and code(out) == "already_current", f"{s}")
s, out = a.call("POST", "/api/billing/subscription", {"planId": "pro", "interval": "year"})
sub = out.get("subscription", {})
check("plan: upgrade to Pro yearly starts now", s == 200 and out.get("effective") == "now" and sub.get("planId") == "pro" and sub.get("interval") == "year", f"{s} {str(out)[:160]}")
check("credits: Pro month granted", out.get("balance") == start + 400000 + 1200000, f"{out.get('balance')}")
year_span = sub.get("currentPeriodEnd", 0) - sub.get("currentPeriodStart", 0)
check("plan: yearly period is about a year", 364 * 86400000 <= year_span <= 367 * 86400000, f"{year_span}")
s, out = a.call("POST", "/api/billing/subscription", {"planId": "plus"})
sub = out.get("subscription", {})
check("plan: downgrade waits for period end", s == 200 and out.get("effective") == "period_end" and sub.get("planId") == "pro" and (sub.get("pendingChange") or {}).get("planId") == "plus", f"{s} {str(out)[:200]}")
s, out = a.call("POST", "/api/billing/demo/end-period")
sub = out.get("subscription", {})
check("renewal: pending downgrade applied", s == 200 and sub.get("planId") == "plus" and sub.get("interval") == "year" and sub.get("pendingChange") is None, f"{s} {str(out)[:200]}")
check("credits: new period grants once", out.get("balance") == start + 400000 + 1200000 + 400000, f"{out.get('balance')}")
s, out = a.call("POST", "/api/billing/subscription/cancel")
check("plan: cancel at period end", s == 200 and out["subscription"]["status"] == "canceling" and out["subscription"]["renewsAt"] is None, f"{s} {str(out)[:160]}")
s, out = a.call("POST", "/api/billing/subscription/cancel")
check("plan: cancel twice is 409", s == 409, f"{s}")
s, out = a.call("POST", "/api/billing/subscription/resume")
check("plan: resume", s == 200 and out["subscription"]["status"] == "active", f"{s}")
s, out = a.call("POST", "/api/billing/subscription/resume")
check("plan: resume when not canceling is 409", s == 409, f"{s}")
s, out = a.call("POST", "/api/billing/subscription", {"interval": "month"})
check("plan: yearly to monthly waits for period end", s == 200 and out.get("effective") == "period_end" and (out["subscription"].get("pendingChange") or {}).get("interval") == "month", f"{s} {str(out)[:160]}")
a.call("POST", "/api/billing/subscription/cancel")
before_end = balance(a)
s, out = a.call("POST", "/api/billing/demo/end-period")
check("plan: canceled plan ends, back on Free", s == 200 and out["subscription"]["status"] == "free" and out["subscription"]["planId"] == "free", f"{s} {str(out)[:160]}")
check("credits: no grant after the plan ended", balance(a) == before_end, f"{before_end} -> {balance(a)}")
s, out = a.call("GET", "/api/auth/me")
check("plan: users.plan back to free", out["user"]["plan"] == "free", out["user"]["plan"])

# --- receipts --------------------------------------------------------------------------
s, out = a.call("GET", "/api/billing/receipts")
rs = out.get("receipts", [])
check("receipts: one per charge, newest first", s == 200 and [r["planId"] for r in rs] == ["plus", "pro", "plus"] and all(r["demo"] and r["status"] == "paid" for r in rs), f"{s} {[r.get('planId') for r in rs]}")
check("receipts: amounts", [r["amountCents"] for r in rs] == [19000, 49000, 1900], f"{[r.get('amountCents') for r in rs]}")
s, out = b.call("GET", "/api/billing/receipts")
check("privacy: B sees none of A's receipts", s == 200 and out["receipts"] == [], f"{s}")

# --- usage -----------------------------------------------------------------------------
s, out = a.call("GET", "/api/billing/usage?days=7")
u = out.get("usage", {})
models = [m["modelId"] for m in u.get("perModel", [])]
check("usage: spend per day, kind and model", s == 200 and len(u.get("perDay", [])) == 7 and u["totals"]["spent"] > 0 and "flux-schnell" in models and u["perKind"][0]["kind"] == "image" and sum(d["spent"] for d in u["perDay"]) == u["totals"]["spent"], str(u)[:240])
s, out = b.call("GET", "/api/billing/usage")
check("privacy: B's usage is empty", s == 200 and out["usage"]["totals"]["spent"] == 0 and out["usage"]["perModel"] == [], f"{s}")

# --- promo codes -----------------------------------------------------------------------
before = balance(a)
s, out = a.call("POST", "/api/billing/promo", {"code": " hello-parallax "})
check("promo: redeem", s == 200 and out.get("credits") == 25000 and out.get("balance") == before + 25000, f"{s} {str(out)[:120]}")
s, out = a.call("POST", "/api/billing/promo", {"code": "HELLO-PARALLAX"})
check("promo: second time is 409", s == 409 and code(out) == "already_redeemed", f"{s}")
s, out = a.call("POST", "/api/billing/promo", {"code": "NOPE-NOT-REAL"})
check("promo: unknown code is 404", s == 404, f"{s}")
s, out = a.call("POST", "/api/billing/promo", {"code": 7})
check("promo: wrong type is 400", s == 400, f"{s}")
s, out = b.call("POST", "/api/billing/promo", {"code": "HELLO-PARALLAX"})
check("promo: another member can redeem", s == 200, f"{s}")

# --- referrals -------------------------------------------------------------------------
s, ref = a.call("GET", "/api/account/referral")
check("referral: code and link", s == 200 and len(ref.get("code", "")) == 8 and ref["code"] in ref["path"], str(ref)[:160])
s, again = a.call("GET", "/api/account/referral")
check("referral: code is stable", again.get("code") == ref.get("code"))
s, out = a.call("POST", "/api/account/referral/claim", {"code": ref["code"]})
check("referral: own code refused", s == 400, f"{s}")
guest = Member()
guest.call("POST", "/api/auth/guest")
s, out = guest.call("POST", "/api/account/referral/claim", {"code": ref["code"]})
check("referral: guests must sign up first", s == 409, f"{s}")
a0, b0 = balance(a), balance(b)
s, out = b.call("POST", "/api/account/referral/claim", {"code": ref["code"].lower()})
check("referral: claim pays both", s == 200 and balance(b) == b0 + 50000 and balance(a) == a0 + 50000, f"{s} {a0}->{balance(a)} {b0}->{balance(b)}")
s, out = b.call("POST", "/api/account/referral/claim", {"code": ref["code"]})
check("referral: only once", s == 409 and balance(a) == a0 + 50000, f"{s}")
s, out = a.call("GET", "/api/account/referral")
check("referral: inviter sees the count", out.get("invited") == 1 and out.get("creditsEarned") == 50000, str(out)[:120])

# --- sessions --------------------------------------------------------------------------
a2 = Member()
s, out = a2.call("POST", "/api/auth/login", {"email": a_email, "password": "correct horse battery"})
check("sessions: second device signs in", s == 200, f"{s}")
s, out = a.call("GET", "/api/account/sessions")
sess = out.get("sessions", [])
check("sessions: both listed, one current", s == 200 and len(sess) == 2 and sum(1 for x in sess if x["current"]) == 1, str(out)[:200])
check("sessions: each says device and last active", all(isinstance(x.get("device"), str) and isinstance(x.get("lastSeenAt"), int) and x["lastSeenAt"] >= x["createdAt"] for x in sess), str(sess)[:200])
ua = Member()
s, out = ua.call("POST", "/api/auth/login", {"email": a_email, "password": "correct horse battery"}, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"})
named = [x.get("device") for x in a.call("GET", "/api/account/sessions")[1].get("sessions", [])]
check("sessions: a browser is named", s == 200 and "Chrome on macOS" in named, str(named))
ua.call("POST", "/api/auth/logout", {})
other_id = next((x["id"] for x in sess if not x["current"]), "")
mine_id = next((x["id"] for x in sess if x["current"]), "")
s, out = b.call("DELETE", f"/api/account/sessions/{other_id}")
check("privacy: B cannot sign out A's session", s == 404, f"{s}")
s, out = a.call("DELETE", f"/api/account/sessions/{mine_id}")
check("sessions: cannot revoke this one by id", s == 400, f"{s}")
s, out = a.call("DELETE", f"/api/account/sessions/{other_id}")
check("sessions: revoke one", s == 200, f"{s}")
check("sessions: that device is signed out", a2.call("GET", "/api/auth/me")[1].get("user") is None)
a2.call("POST", "/api/auth/login", {"email": a_email, "password": "correct horse battery"})
s, out = a.call("DELETE", "/api/account/sessions")
check("sessions: sign out the others", s == 200 and out.get("signedOut") == 1 and a2.call("GET", "/api/auth/me")[1].get("user") is None, f"{s} {out}")
check("sessions: this device stays in", a.call("GET", "/api/auth/me")[1].get("user") is not None)

# --- email and password ----------------------------------------------------------------
s, out = a.call("POST", "/api/account/email", {"email": b_email, "password": "correct horse battery"})
check("email: taken is 409", s == 409, f"{s}")
s, out = a.call("POST", "/api/account/email", {"email": "new@example", "password": "correct horse battery"})
check("email: invalid is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/account/email", {"email": f"new-{a_email}", "password": "wrong password"})
check("email: wrong password is 403", s == 403, f"{s}")
a_email = f"new-{a_email}"
s, out = a.call("POST", "/api/account/email", {"email": a_email.upper(), "password": "correct horse battery"})
check("email: changed", s == 200 and out["user"]["email"] == a_email, f"{s} {str(out)[:120]}")
s, out = a.call("POST", "/api/account/password", {"currentPassword": "nope nope nope", "newPassword": "another long phrase"})
check("password: wrong current is 403", s == 403, f"{s}")
s, out = a.call("POST", "/api/account/password", {"currentPassword": "correct horse battery", "newPassword": "short"})
check("password: too short is 400", s == 400, f"{s}")
s, out = a.call("POST", "/api/account/password", {"currentPassword": "correct horse battery", "newPassword": "another long phrase"})
check("password: changed", s == 200 and out.get("changed") is True, f"{s}")
s, out = a2.call("POST", "/api/auth/login", {"email": a_email, "password": "another long phrase"})
check("password: new one signs in", s == 200, f"{s}")
s, out = guest.call("POST", "/api/account/password", {"currentPassword": "", "newPassword": "another long phrase"})
check("password: guests are told to sign up", s == 409, f"{s}")
s, out = a.call("POST", "/api/account/password", {"currentPassword": "another long phrase", "newPassword": "third long phrase"}, headers={"Origin": "https://evil.example"})
check("cross-site write refused", s == 403, f"{s}")

# --- delete ----------------------------------------------------------------------------
s, out = a.call("DELETE", "/api/account", {"password": "another long phrase"})
check("delete: needs DELETE typed", s == 400, f"{s}")
s, out = a.call("DELETE", "/api/account", {"password": "wrong", "confirm": "DELETE"})
check("delete: wrong password is 403", s == 403, f"{s}")
s, out = a.call("DELETE", "/api/account", {"password": "another long phrase", "confirm": "DELETE"})
check("delete: account removed", s == 200 and out.get("deleted") is True, f"{s} {out}")
check("delete: signed out everywhere", a.call("GET", "/api/account")[0] == 401 and a2.call("GET", "/api/account")[0] == 401)
s, out = anon.call("POST", "/api/auth/login", {"email": a_email, "password": "another long phrase"})
check("delete: cannot sign in again", s == 400, f"{s}")
s, out = b.call("GET", "/api/account/referral")
check("delete: B keeps their account", s == 200, f"{s}")
s, out = guest.call("DELETE", "/api/account", {"confirm": "DELETE"})
check("delete: guest needs no password", s == 200, f"{s} {out}")

print(f"\n{sum(results)}/{len(results)} checks passed")
sys.exit(0 if all(results) else 1)
