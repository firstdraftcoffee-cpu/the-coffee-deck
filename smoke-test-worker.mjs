import worker, { createPass, readPass } from "./worker/index.js";
const env = { STRIPE_SECRET_KEY: "sk_test_abc", ASSETS: { fetch: async () => new Response("asset") } };
let fails = 0;
const check = (l, c) => { console.log((c ? "PASS" : "FAIL") + " - " + l); if (!c) fails++; };

const pass = await createPass(env, "a@b.com");
check("valid pass reads back", (await readPass(env, pass))?.email === "a@b.com");
check("tampered pass rejected", (await readPass(env, pass.slice(0, -2) + "xx")) === null);
const forged = Buffer.from(JSON.stringify({ email: "x@y.com", exp: Date.now() + 1e9 })).toString("base64url") + "." + pass.split(".")[1];
check("forged payload rejected", (await readPass(env, forged)) === null);
check("expired pass rejected", (await readPass(env, await createPass(env, "a@b.com", Date.now() - 9 * 86400000))) === null);
check("pass signed with another key rejected", (await readPass({ STRIPE_SECRET_KEY: "sk_other" }, pass)) === null);

const noPass = await worker.fetch(new Request("https://x/api/deck?lang=en"), env);
check("deck without pass -> 401", noPass.status === 401);
const bad = await worker.fetch(new Request("https://x/api/deck?lang=en", { headers: { Authorization: "Bearer junk" } }), env);
check("deck with junk pass -> 401", bad.status === 401);
const ok = await worker.fetch(new Request("https://x/api/deck?lang=de", { headers: { Authorization: "Bearer " + pass } }), env);
const cards = await ok.json();
check("deck with valid pass -> full localized deck", ok.status === 200 && cards.length === 400 && !cards[0].translations);
check("static assets still pass through", (await (await worker.fetch(new Request("https://x/index.html"), env)).text()) === "asset");
process.exitCode = fails ? 1 : 0;

// =====================================================================
// EMAIL SIGN-IN LINKS - Stripe and Resend are faked; no real calls
// =====================================================================

const { createSigninToken, signinEmail, EMAIL_ONLY_UPGRADE_UNTIL } = await import("./worker/index.js");

const SUBSCRIBER = "fan@example.com";
let sentEmails = [];
let subscriberActive = true;

globalThis.fetch = async (url, options) => {
    url = String(url);
    if (url.startsWith("https://api.stripe.com/v1/customers")) {
        const email = decodeURIComponent(url.match(/email=([^&]+)/)[1]);
        return new Response(JSON.stringify({ data: email === SUBSCRIBER ? [{ id: "cus_1" }] : [] }));
    }
    if (url.startsWith("https://api.stripe.com/v1/subscriptions")) {
        const status = url.match(/status=(\w+)/)[1];
        return new Response(JSON.stringify({ data: subscriberActive && status === "active" ? [{ id: "sub_1" }] : [] }));
    }
    if (url === "https://api.resend.com/emails") {
        sentEmails.push(JSON.parse(options.body));
        return new Response(JSON.stringify({ id: "email_1" }));
    }
    throw new Error("Unexpected fetch in worker test: " + url);
};

const withResend = { ...env, RESEND_API_KEY: "re_test", SITE_URL: "https://thecoffeedeck.net" };
const post = (path, body, e = withResend, headers = {}) =>
    worker.fetch(new Request(`https://thecoffeedeck.net${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body || {}) }), e);

// Before Resend is set up: restore keeps working the old way
const direct = await (await post("/api/request-link", { email: SUBSCRIBER }, env)).json();
check("Without Resend key: subscriber restores directly (nobody locked out before setup)", direct.mode === "direct" && direct.active && !!direct.pass);
const directNo = await (await post("/api/request-link", { email: "stranger@example.com" }, env)).json();
check("Without Resend key: non-subscriber gets no pass", directNo.mode === "direct" && !directNo.active && !directNo.pass);

// With Resend: email link only
const sub = await (await post("/api/request-link", { email: SUBSCRIBER, lang: "de" })).json();
check("With Resend key: subscriber gets 'check your email', no pass handed out", sub.mode === "email" && !sub.pass);
check("Exactly one sign-in email sent to the subscriber", sentEmails.length === 1 && sentEmails[0].to[0] === SUBSCRIBER);
check("Email is in the requested language", sentEmails[0]?.subject.includes("Anmeldelink"));
const linkMatch = sentEmails[0]?.html.match(/href="([^"]+)"/);
check("Email contains a sign-in link to the site", !!linkMatch && linkMatch[1].startsWith("https://thecoffeedeck.net/?signin="));

const stranger = await (await post("/api/request-link", { email: "stranger@example.com" })).json();
check("Non-subscriber gets the identical reply (can't probe who subscribes)", JSON.stringify(stranger) === JSON.stringify(sub));
check("No email sent to a non-subscriber", sentEmails.length === 1);

const token = decodeURIComponent(new URL(linkMatch[1].replace(/&amp;/g, "&")).searchParams.get("signin"));
const redeemed = await (await post("/api/redeem-link", { token })).json();
check("Redeeming the emailed link gives a working pass", redeemed.active && redeemed.email === SUBSCRIBER && !!(await readPass(env, redeemed.pass)));

const tampered = await (await post("/api/redeem-link", { token: token.slice(0, -3) + "abc" })).json();
check("Tampered sign-in link is rejected", !tampered.active && !tampered.pass);
const expiredToken = await createSigninToken(env, SUBSCRIBER, Date.now() - 21 * 60 * 1000);
check("Sign-in link older than 20 minutes is rejected", !(await (await post("/api/redeem-link", { token: expiredToken })).json()).active);
const passAsLink = await (await post("/api/redeem-link", { token: await createPass(env, SUBSCRIBER) })).json();
check("An access pass can't be used as a sign-in link", !passAsLink.active);
const linkAsPass = await worker.fetch(new Request("https://x/api/deck?lang=en", { headers: { Authorization: "Bearer " + token } }), env);
check("A sign-in link can't be used as an access pass for the deck", linkAsPass.status === 401);

// Daily refresh uses the pass, not the email
const freshPass = await (await post("/api/refresh-pass", {}, withResend, { Authorization: "Bearer " + redeemed.pass })).json();
check("Refresh with a valid pass returns a new pass", freshPass.active && !!freshPass.pass);
const oldPass = await createPass(env, SUBSCRIBER, Date.now() - 30 * 86400000);
check("Refresh still works for a pass that ran out while offline (Stripe re-checked)", (await (await post("/api/refresh-pass", {}, withResend, { Authorization: "Bearer " + oldPass })).json()).active);
check("Refresh with a junk pass is refused", (await post("/api/refresh-pass", {}, withResend, { Authorization: "Bearer junk" })).status === 401);
subscriberActive = false;
const cancelled = await (await post("/api/refresh-pass", {}, withResend, { Authorization: "Bearer " + redeemed.pass })).json();
check("Refresh after cancelling returns no pass", !cancelled.active && !cancelled.pass);
check("Sign-in link for a cancelled subscription gives no pass", !(await (await post("/api/redeem-link", { token })).json()).active);
subscriberActive = true;

// Grace period for browsers saved before passes existed
const legacyNow = await (await post("/api/verify-access", { email: SUBSCRIBER })).json();
const graceOpen = Date.now() <= EMAIL_ONLY_UPGRADE_UNTIL;
check(graceOpen ? "Grace period open: saved-email upgrade still works" : "Grace period over: saved-email upgrade is closed",
    graceOpen ? legacyNow.active && !!legacyNow.pass : !legacyNow.active && !legacyNow.pass);
const realNow = Date.now;
Date.now = () => EMAIL_ONLY_UPGRADE_UNTIL + 1000;
const legacyAfter = await (await post("/api/verify-access", { email: SUBSCRIBER })).json();
Date.now = realNow;
check("After the grace date, typing an email alone unlocks nothing", !legacyAfter.active && !legacyAfter.pass);
check("Grace period ends 8 October 2026", new Date(EMAIL_ONLY_UPGRADE_UNTIL).toISOString().startsWith("2026-10-08"));

check("Sign-in email exists in all six languages", ["en", "es", "pt", "de", "fr", "it"].every(l => signinEmail("https://x", l).subject.length > 0) && new Set(["en", "es", "pt", "de", "fr", "it"].map(l => signinEmail("https://x", l).subject)).size === 6);
check("Email escapes the link safely", !signinEmail('https://x/"><script>', "en").html.includes("<script>"));
