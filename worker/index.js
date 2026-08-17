const STRIPE_API = "https://api.stripe.com/v1";

function corsHeaders() {

    return {

        "Access-Control-Allow-Origin": "*",

        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",

        "Access-Control-Allow-Headers": "Content-Type"

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

    return json({

        active: true,
        email: session.customer_details?.email || session.customer_email

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

            return json({ active: true, email });

        }

        const trialing = await stripeRequest(env, `subscriptions?customer=${customer.id}&status=trialing&limit=1`);

        if (trialing.data && trialing.data.length > 0) {

            return json({ active: true, email });

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

            if (url.pathname === "/api/verify-access" && request.method === "POST") {

                return await verifyAccess(request, env);

            }

        } catch (err) {

            return json({ error: err.message || "Server error" }, 500);

        }

        return env.ASSETS.fetch(request);

    }

};
