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

export async function createPass(env, email, now = Date.now()) {

    const payload = toBase64Url(encoder.encode(JSON.stringify({ email, exp: now + PASS_LIFETIME_MS })));

    const signature = await crypto.subtle.sign("HMAC", await signingKey(env), encoder.encode(payload));

    return `${payload}.${toBase64Url(new Uint8Array(signature))}`;

}

export async function readPass(env, pass, now = Date.now()) {

    if (typeof pass !== "string" || !pass.includes(".")) return null;

    const [payload, signature] = pass.split(".");

    try {

        const valid = await crypto.subtle.verify(
            "HMAC",
            await signingKey(env),
            fromBase64Url(signature),
            encoder.encode(payload)
        );

        if (!valid) return null;

        const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));

        return data.exp > now ? data : null;

    } catch {

        return null;

    }

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
        "locale": locale === "es" ? "es" : locale === "pt" ? "pt-BR" : "en"

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

async function verifyAccess(request, env) {

    const { email } = await request.json();

    if (!email) {

        return json({ error: "Missing email" }, 400);

    }

    const customers = await stripeRequest(env, `customers?email=${encodeURIComponent(email)}&limit=5`);

    if (!customers.data || customers.data.length === 0) {

        return json({ active: false });

    }

    for (const customer of customers.data) {

        const subs = await stripeRequest(env, `subscriptions?customer=${customer.id}&status=active&limit=1`);

        if (subs.data && subs.data.length > 0) {

            return json({ active: true, email, pass: await createPass(env, email) });

        }

        const trialing = await stripeRequest(env, `subscriptions?customer=${customer.id}&status=trialing&limit=1`);

        if (trialing.data && trialing.data.length > 0) {

            return json({ active: true, email, pass: await createPass(env, email) });

        }

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

            if (url.pathname === "/api/verify-access" && request.method === "POST") {

                return await verifyAccess(request, env);

            }

        } catch (err) {

            return json({ error: err.message || "Server error" }, 500);

        }

        return env.ASSETS.fetch(request);

    }

};
