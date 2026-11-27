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
    if (!env.ACCESS_TOKEN_SECRET && !env.STRIPE_SECRET_KEY) throw new Error("Access signing unavailable");
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

async function tokenHash(token) {
    return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))), b=>b.toString(16).padStart(2,"0")).join("");
}

async function authLimit(env, scope, max, windowMs, now) {
    const digest = toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(env), encoder.encode("limit:"+scope))));
    const row = await env.AUTH_DB.prepare("INSERT INTO deck_auth_limits(scope,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(scope) DO UPDATE SET attempts=CASE WHEN expires_at <= ? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING attempts").bind(digest,now+windowMs,now,now).first();
    return Boolean(row && row.attempts <= max);
}

async function requestLink(request, env) {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:"Missing email"},400);
    if (!env.RESEND_API_KEY || !env.ACCESS_TOKEN_SECRET || !env.AUTH_DB) return json({error:"Email sign-in temporarily unavailable"},503);
    const now = Date.now();
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!(await authLimit(env,"ip:"+ip,20,15*60*1000,now))) return json({mode:"email"});
    if (!(await authLimit(env,"email:"+email,2,15*60*1000,now))) return json({mode:"email"});
    // Remove expired records in bounded batches.
    await env.AUTH_DB.prepare("DELETE FROM deck_signin_tokens WHERE token_hash IN (SELECT token_hash FROM deck_signin_tokens WHERE expires_at <= ? LIMIT 100)").bind(now).run();
    await env.AUTH_DB.prepare("DELETE FROM deck_auth_limits WHERE scope IN (SELECT scope FROM deck_auth_limits WHERE expires_at <= ? LIMIT 100)").bind(now).run();
    if (await hasAccess(env,email)) {
        const exp = now + SIGNIN_LINK_LIFETIME_MS;
        const token = await signToken(env,{kind:"signin",email,exp,nonce:crypto.randomUUID()});
        const hash = await tokenHash(token);
        await env.AUTH_DB.prepare("INSERT INTO deck_signin_tokens(token_hash,email,expires_at) VALUES (?,?,?)").bind(hash,email,exp).run();
        try {
            await sendSigninEmail(env,email,"https://thecoffeedeck.net/?signin="+encodeURIComponent(token),body.lang);
        } catch {
            await env.AUTH_DB.prepare("DELETE FROM deck_signin_tokens WHERE token_hash=?").bind(hash).run();
            console.warn("Deck sign-in email delivery failed");
        }
    }
    return json({mode:"email"});
}

async function redeemLink(request, env) {
    if (!env.ACCESS_TOKEN_SECRET || !env.AUTH_DB) return json({error:"Email sign-in temporarily unavailable"},503);
    const {token} = await request.json();
    if(typeof token !== "string" || token.length>4096) return json({active:false,reason:"invalid-link"});
    const data = await readToken(env,token);
    if (!data || data.kind !== "signin" || !data.nonce || typeof data.email!=="string" || data.exp<=Date.now()) return json({active:false,reason:"invalid-link"});
    const now = Date.now();
    const hash = await tokenHash(token);
    const row = await env.AUTH_DB.prepare("UPDATE deck_signin_tokens SET used_at=? WHERE token_hash=? AND email=? AND expires_at>? AND used_at IS NULL RETURNING email").bind(now,hash,data.email,now).first();
    if (!row) return json({active:false,reason:"invalid-link"});
    if (!(await hasAccess(env,row.email))) return json({active:false,reason:"no-access"});
    return json({active:true,email:row.email,pass:await createPass(env,row.email)});
}

async function refreshPass(request, env) {

    const auth = request.headers.get("Authorization") || "";

    const data = await readToken(env, auth.replace(/^Bearer\s+/i, ""));

    if (!isPass(data) || data.exp + PASS_REFRESH_WINDOW_MS <= Date.now()) {

        return json({ active: false, reason: "invalid-pass" }, 401);

    }

    if (!(await hasAccess(env, data.email))) {

        return json({ active: false, reason: "no-access" });

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
            "Cache-Control": "private, no-store",
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

    const { locale } = await request.json();

    const priceId = env.STRIPE_PRICE_LIFETIME;

    if (!priceId) {

        return json({ error: "Lifetime price not set up" }, 400);

    }

    const origin = new URL(request.url).origin;

    const session = await stripeRequest(env, "checkout/sessions", "POST", {

        "mode": "payment",
        "customer_creation": "always",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        "success_url": `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        "cancel_url": `${origin}/?checkout=cancelled`,
        "allow_promotion_codes": "true",
        "locale": { es: "es", pt: "pt-BR", de: "de", fr: "fr", it: "it" }[locale] || "en"

    });

    return json({ url: session.url });

}

function isPaidDeckCheckout(session,priceId){return Boolean(priceId&&session?.mode==="payment"&&session.status==="complete"&&session.payment_status==="paid"&&session.line_items?.has_more===false&&session.line_items?.data?.length===1&&session.line_items.data[0].price?.id===priceId&&session.line_items.data[0].quantity===1)}

async function checkoutSuccess(request, env) {

    const url = new URL(request.url);

    const sessionId = url.searchParams.get("session_id");

    if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9_]+$/.test(sessionId)) {

        return json({ error: "Missing session_id" }, 400);

    }

    const session = await stripeRequest(env, `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`);

    if (!isPaidDeckCheckout(session, env.STRIPE_PRICE_LIFETIME)) {

        return json({ active: false });

    }

    const email = session.customer_details?.email || session.customer_email;
    if (typeof email !== "string" || !email) return json({active:false});

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

            const subs = await stripeRequest(env, `subscriptions?customer=${customer.id}&status=${status}&limit=100`);

            if ((subs.data || []).some(sub => (sub.items?.data || []).some(item => [env.STRIPE_PRICE_MONTHLY, env.STRIPE_PRICE_YEARLY].filter(Boolean).includes(item.price?.id)))) return true;

        }

    }

    return false;

}

// A paid one-off lifetime purchase, matched by the customer's email.
async function hasPurchased(env, email) {

    if (!env.STRIPE_PRICE_LIFETIME) return false;

    const customers = await stripeRequest(env, `customers?email=${encodeURIComponent(email)}&limit=5`);

    for (const customer of customers.data || []) {

        const sessions = await stripeRequest(env, `checkout/sessions?customer=${customer.id}&limit=20&expand[]=data.line_items`);

        for (const session of sessions.data || []) {

            if (session.payment_status !== "paid") continue;

            if ((session.line_items?.data || []).some(item => item.price?.id === env.STRIPE_PRICE_LIFETIME)) return true;

        }

    }

    return false;

}

// Access = the lifetime purchase, or a subscription from before the switch.
async function hasAccess(env, email) {

    return (await hasPurchased(env, email)) || (await hasActiveSubscription(env, email));

}

// Old email-only check, kept only so browsers saved before access passes
// existed can upgrade during the grace period. Closes after the cutoff.
async function verifyAccess(request, env) {
    return json({ active: false, reason: "closed" });
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

            return json({ error: "Service temporarily unavailable" }, 500);

        }

        return env.ASSETS.fetch(request);

    }

};
