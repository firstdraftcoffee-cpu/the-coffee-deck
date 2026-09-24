import { save, load } from "./storage.js";

const REVERIFY_AFTER_MS = 24 * 60 * 60 * 1000;

export function hasAccess() {

    const access = load("access", null);

    if (!access || !access.email) return false;

    return access.verifiedAt && (Date.now() - access.verifiedAt) < (REVERIFY_AFTER_MS * 7);

}

export function getAccessPass() {

    const access = load("access", null);

    return access?.pass || null;

}

export function getAccessEmail() {

    const access = load("access", null);

    return access?.email || null;

}

function setAccess(email, pass) {

    save("access", {

        email,
        pass,
        verifiedAt: Date.now()

    });

}

export function clearAccess() {

    save("access", null);

}

export async function startCheckout(plan, locale) {

    const res = await fetch("/api/create-checkout-session", {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, locale })

    });

    if (!res.ok) {

        throw new Error("Could not start checkout");

    }

    const data = await res.json();

    if (data.url) {

        window.location.href = data.url;

    } else {

        throw new Error(data.error || "Could not start checkout");

    }

}

// Restore on a new device. Returns:
//   "unlocked"  - access granted straight away (only before email sign-in is set up)
//   "emailSent" - a sign-in link was emailed (if that email has a subscription)
//   "notFound"  - no subscription for that email (direct mode only)
export async function restoreAccess(email, locale) {

    const res = await fetch("/api/request-link", {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang: locale })

    });

    if (!res.ok) {

        throw new Error("Could not restore access");

    }

    const data = await res.json();

    if (data.mode === "email") {

        return "emailSent";

    }

    if (data.active) {

        setAccess(data.email || email, data.pass);

        return "unlocked";

    }

    return "notFound";

}

// Handles arriving from the emailed sign-in link (?signin=...).
// Returns null if there was no link, true if it unlocked, false if the
// link had expired or was no good.
export async function handleSigninLink() {

    const url = new URL(window.location.href);

    const token = url.searchParams.get("signin");

    if (!token) return null;

    url.searchParams.delete("signin");

    window.history.replaceState({}, "", url.pathname + url.search);

    try {

        const res = await fetch("/api/redeem-link", {

            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })

        });

        const data = await res.json();

        if (data.active && data.email && data.pass) {

            setAccess(data.email, data.pass);

            return true;

        }

    } catch {

        // fall through

    }

    return false;

}

export async function handleCheckoutReturn() {

    const url = new URL(window.location.href);

    const checkout = url.searchParams.get("checkout");

    if (checkout === "success") {

        const sessionId = url.searchParams.get("session_id");

        window.history.replaceState({}, "", url.pathname);

        if (!sessionId) return false;

        try {

            const res = await fetch(`/api/checkout-success?session_id=${encodeURIComponent(sessionId)}`);

            const data = await res.json();

            if (data.active && data.email) {

                setAccess(data.email, data.pass);

                return true;

            }

        } catch {

            return false;

        }

    } else if (checkout === "cancelled") {

        window.history.replaceState({}, "", url.pathname);

    }

    return false;

}

// Daily check that the subscription is still active. Uses the saved access
// pass (the server re-checks Stripe and hands back a fresh one). Browsers
// saved before passes existed upgrade using their saved email, which the
// server only allows during a short grace period.
export async function reverifyIfStale() {

    const access = load("access", null);

    if (!access || !access.email) return;

    if (access.pass && Date.now() - access.verifiedAt < REVERIFY_AFTER_MS) return;

    try {

        const res = access.pass
            ? await fetch("/api/refresh-pass", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${access.pass}` }
            })
            : await fetch("/api/verify-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: access.email })
            });

        const data = await res.json();

        if (data.active && data.pass) {

            setAccess(data.email || access.email, data.pass);

        } else {

            clearAccess();

        }

    } catch {

        // network hiccup - keep cached access, try again next load

    }

}
