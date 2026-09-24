import deck from "./deck.js";

const STRIPE_API = "https://api.stripe.com/v1";

// Access passes: after Stripe confirms a subscription, the worker hands the
// browser a signed pass (email + expiry). /api/deck only serves the full deck
// to requests carrying a valid, unexpired pass. The browser re-verifies with
// Stripe daily and gets a fresh pass each time, so a cancelled subscription
// stops working within the pass lifetime.
const PASS_LIFETIME_MS = 8 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toBase64Url(bytes) {

    let binary = "";

    bytes.forEach(b => { binary += String.fromCharCode(b); });

    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

}

function fromBase64Url(text) {

    const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);

    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));

}

async function signingKey(env) {

    // A dedicated ACCESS_TOKEN_SECRET is used if one is set; otherwise the key
    // is derived from the Stripe secret, so no extra setup is needed.
    const secret = env.ACCESS_TOKEN_SECRET || `coffee-deck-access:${env.STRIPE_SECRET_KEY}`;

    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );

}

async function signToken(env, data) {

    const payload = toBase64Url(encoder.encode(JSON.stringify(data)));

    const signature = await crypto.subtle.sign("HMAC", await signingKey(env), encoder.encode(payload));

    return `${payload}.${toBase64Url(new Uint8Array(signature))}`;

}

// Returns the token's contents if the signature is genuine, else null.
// Expiry is checked by the caller, since passes and sign-in links differ.
async function readToken(env, token) {

    if (typeof token !== "string" || !token.includes(".")) return null;

    const [payload, signature] = token.split(".");

    try {

        const valid = await crypto.subtle.verify(
            "HMAC",
            await signingKey(env),
            fromBase64Url(signature),
            encoder.encode(payload)
        );

        return valid ? JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) : null;

    } catch {

        return null;

    }

}

export async function createPass(env, email, now = Date.now()) {

    return signToken(env, { kind: "pass", email, exp: now + PASS_LIFETIME_MS });

}

// Passes issued before sign-in links existed have no "kind"; they are passes.
function isPass(data) {

    return data && (data.kind === undefined || data.kind === "pass");

}

export async function readPass(env, pass, now = Date.now()) {

    const data = await readToken(env, pass);

    return isPass(data) && data.exp > now ? data : null;

}

// --- Email sign-in links -----------------------------------------------------

const SIGNIN_LINK_LIFETIME_MS = 20 * 60 * 1000;

// A pass that has run out (phone offline for a while) can still be swapped
// for a fresh one, because Stripe is re-checked every time. Past this age
// the subscriber signs in again with an email link.
const PASS_REFRESH_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

// Grace period: until this date, a browser saved from before access passes
// existed can still upgrade using just its saved email. After it, only
// Stripe checkout, an email sign-in link, or an existing pass unlock the deck.
export const EMAIL_ONLY_UPGRADE_UNTIL = Date.parse("2026-10-08T23:59:59Z");

export async function createSigninToken(env, email, now = Date.now()) {

    return signToken(env, { kind: "signin", email, exp: now + SIGNIN_LINK_LIFETIME_MS });

}

const EMAIL_TEXT = {
    en: { subject: "Your Coffee Deck sign-in link", intro: "Tap the button below to unlock Coffee Deck Pro on this device.", button: "Sign in to The Coffee Deck", note: "This link works for 20 minutes. If you didn't ask for it, you can ignore this email." },
    es: { subject: "Tu enlace de acceso a The Coffee Deck", intro: "Pulsa el botón para desbloquear Coffee Deck Pro en este dispositivo.", button: "Entrar en The Coffee Deck", note: "Este enlace funciona durante 20 minutos. Si no lo pediste, puedes ignorar este correo." },
    pt: { subject: "Seu link de acesso ao The Coffee Deck", intro: "Toque no botão abaixo para desbloquear o Coffee Deck Pro neste dispositivo.", button: "Entrar no The Coffee Deck", note: "Este link funciona por 20 minutos. Se você não pediu, pode ignorar este e-mail." },
    de: { subject: "Dein Anmeldelink für The Coffee Deck", intro: "Tippe auf den Button, um Coffee Deck Pro auf diesem Gerät freizuschalten.", button: "Bei The Coffee Deck anmelden", note: "Dieser Link ist 20 Minuten gültig. Wenn du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren." },
    fr: { subject: "Votre lien de connexion à The Coffee Deck", intro: "Touchez le bouton ci-dessous pour débloquer Coffee Deck Pro sur cet appareil.", button: "Se connecter à The Coffee Deck", note: "Ce lien est valable 20 minutes. Si vous ne l'avez pas demandé, ignorez simplement cet e-mail." },
    it: { subject: "Il tuo link di accesso a The Coffee Deck", intro: "Tocca il pulsante qui sotto per sbloccare Coffee Deck Pro su questo dispositivo.", button: "Accedi a The Coffee Deck", note: "Questo link è valido per 20 minuti. Se non l'hai richiesto, puoi ignorare questa email." }
};

function escapeHtml(text) {

    return text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);

}

export function signinEmail(link, lang) {

    const text = EMAIL_TEXT[lang] || EMAIL_TEXT.en;

    const html = `<div style="font-family:Nunito,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#2b2320">
<p style="font-size:18px;font-weight:bold;margin:0 0 16px">The Coffee Deck</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 24px">${escapeHtml(text.intro)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#8a5a3c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${escapeHtml(text.button)}</a></p>
<p style="font-size:13px;line-height:1.5;color:#6b5f58;margin:0">${escapeHtml(text.note)}</p>
</div>`;

    return { subject: text.subject, html, text: `${text.intro}\n\n${link}\n\n${text.note}` };

}

async function sendSigninEmail(env, email, link, lang) {

    const message = signinEmail(link, lang);

    const res = await fetch("https://api.resend.com/emails", {

        method: "POST",

        headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            from: env.EMAIL_FROM || "The Coffee Deck <hello@thecoffeedeck.net>",
            to: [email],
            subject: message.subject,
            html: message.html,
            text: message.text
        })

    });

    if (!res.ok) {

        throw new Error(`Resend error ${res.status}: ${await res.text()}`);

    }

}

// Best-effort: at most one sign-in email per address per minute, so the
// form can't be used to flood someone's inbox. (Cloudflare's edge cache
// is per data centre; that's enough for this.)
async function recentlySent(email) {

    if (typeof caches === "undefined" || !caches.default) return false;

    const key = new Request(`https://signin-throttle.internal/${encodeURIComponent(email.toLowerCase())}`);

    if (await caches.default.match(key)) return true;

    await caches.default.put(key, new Response("1", { headers: { "Cache-Control": "max-age=60" } }));

    return false;

}

async function requestLink(request, env) {

    const { email, lang } = await request.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

        return json({ error: "Missing email" }, 400);

    }

    const active = await hasActiveSubscription(env, email);

    // Until Resend is set up, restore works the old way so nobody gets
    // locked out. Adding the RESEND_API_KEY secret switches this off.
    if (!env.RESEND_API_KEY) {

        return json(active
            ? { mode: "direct", active: true, email, pass: await createPass(env, email) }
            : { mode: "direct", active: false });

    }

    if (active && !(await recentlySent(email))) {

        const origin = env.SITE_URL || new URL(request.url).origin;

        const link = `${origin}/?signin=${encodeURIComponent(await createSigninToken(env, email))}`;

        await sendSigninEmail(env, email, link, lang);

    }

    // Same answer whether or not the email belongs to a subscriber.
    return json({ mode: "email" });

}

async function redeemLink(request, env) {

    const { token } = await request.json();

    const data = await readToken(env, token);

    if (!data || data.kind !== "signin" || data.exp <= Date.now()) {

        return json({ active: false, reason: "invalid-link" });

    }

    if (!(await hasActiveSubscription(env, data.email))) {

        return json({ active: false, reason: "no-subscription" });

    }

    return json({ active: true, email: data.email, pass: await createPass(env, data.email) });

}

async function refreshPass(request, env) {

    const auth = request.headers.get("Authorization") || "";

    const data = await readToken(env, auth.replace(/^Bearer\s+/i, ""));

    if (!isPass(data) || data.exp + PASS_REFRESH_WINDOW_MS <= Date.now()) {

        return json({ active: false, reason: "invalid-pass" }, 401);

    }

    if (!(await hasActiveSubscription(env, data.email))) {

        return json({ active: false, reason: "no-subscription" });

    }

    return json({ active: true, email: data.email, pass: await createPass(env, data.email) });

}

async function serveDeck(request, env) {

    const url = new URL(request.url);

    const lang = deck[url.searchParams.get("lang")] ? url.searchParams.get("lang") : "en";

    const auth = request.headers.get("Authorization") || "";

    const pass = await readPass(env, auth.replace(/^Bearer\s+/i, ""));

    if (!pass) {

        return json({ error: "Subscription required" }, 401);

    }

    return new Response(JSON.stringify(deck[lang]), {

        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store"
        }

    });

}

function corsHeaders() {

    return {

        "Access-Control-Allow-Origin": "*",

        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers": "Content-Type, Authorization"

    };

}

function json(data, status = 200) {

    return new Response(JSON.stringify(data), {

        status,

        headers: {
            "Content-Type": "application/json",
            ...corsHeaders()
        }

    });

}

async function stripeRequest(env, path, method = "GET", body = null) {

    const headers = {

        "Authorization": "Basic " + btoa(env.STRIPE_SECRET_KEY + ":"),

        "Content-Type": "application/x-www-form-urlencoded"

    };

    const options = { method, headers };

    if (body) {

        options.body = new URLSearchParams(body).toString();

    }

    const res = await fetch(`${STRIPE_API}/${path}`, options);

    const data = await res.json();

    if (!res.ok) {

        throw new Error(data.error?.message || "Stripe request failed");

    }

    return data;

}

async function createCheckoutSession(request, env) {

    const { plan, locale } = await request.json();

    const priceId = plan === "yearly" ? env.STRIPE_PRICE_YEARLY : env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {

        return json({ error: "Invalid plan" }, 400);

    }

    const origin = new URL(request.url).origin;

    const session = await stripeRequest(env, "checkout/sessions", "POST", {

        "mode": "subscription",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "success_url": `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        "cancel_url": `${origin}/?checkout=cancelled`,
        "allow_promotion_codes": "true",
        "locale": { es: "es", pt: "pt-BR", de: "de", fr: "fr", it: "it" }[locale] || "en"

    });

    return json({ url: session.url });

}

async function checkoutSuccess(request, env) {

    const url = new URL(request.url);

    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {

        return json({ error: "Missing session_id" }, 400);

    }

    const session = await stripeRequest(env, `checkout/sessions/${sessionId}`);

    if (session.payment_status !== "paid" && session.status !== "complete") {

        return json({ active: false });

    }

    const email = session.customer_details?.email || session.customer_email;

    return json({

        active: true,
        email,
        pass: await createPass(env, email)

    });

}

async function hasActiveSubscription(env, email) {

    const customers = await stripeRequest(env, `customers?email=${encodeURIComponent(email)}&limit=5`);

    for (const customer of customers.data || []) {

        for (const status of ["active", "trialing"]) {

            const subs = await stripeRequest(env, `subscriptions?customer=${customer.id}&status=${status}&limit=1`);

            if (subs.data && subs.data.length > 0) return true;

        }

    }

    return false;

}

// Old email-only check, kept only so browsers saved before access passes
// existed can upgrade during the grace period. Closes after the cutoff.
async function verifyAccess(request, env) {

    const { email } = await request.json();

    if (!email) {

        return json({ error: "Missing email" }, 400);

    }

    if (Date.now() > EMAIL_ONLY_UPGRADE_UNTIL && env.RESEND_API_KEY) {

        return json({ active: false, reason: "closed" });

    }

    if (await hasActiveSubscription(env, email)) {

        return json({ active: true, email, pass: await createPass(env, email) });

    }

    return json({ active: false });

}

export default {

    async fetch(request, env, ctx) {

        const url = new URL(request.url);

        if (request.method === "OPTIONS") {

            return new Response(null, { headers: corsHeaders() });

        }

        try {

            if (url.pathname === "/api/create-checkout-session" && request.method === "POST") {

                return await createCheckoutSession(request, env);

            }

            if (url.pathname === "/api/checkout-success" && request.method === "GET") {

                return await checkoutSuccess(request, env);

            }

            if (url.pathname === "/api/deck" && request.method === "GET") {

                return await serveDeck(request, env);

            }

            if (url.pathname === "/api/request-link" && request.method === "POST") {

                return await requestLink(request, env);

            }

            if (url.pathname === "/api/redeem-link" && request.method === "POST") {

                return await redeemLink(request, env);

            }

            if (url.pathname === "/api/refresh-pass" && request.method === "POST") {

                return await refreshPass(request, env);

            }

            if (url.pathname === "/api/verify-access" && request.method === "POST") {

                return await verifyAccess(request, env);

            }

        } catch (err) {

            return json({ error: err.message || "Server error" }, 500);

        }

        return env.ASSETS.fetch(request);

    }

};
