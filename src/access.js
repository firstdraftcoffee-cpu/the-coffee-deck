import { save, load } from "./storage.js";

const REVERIFY_AFTER_MS = 24 * 60 * 60 * 1000;

export function hasAccess() {

    const access = load("access", null);

    if (!access || !access.email) return false;

    return access.verifiedAt && (Date.now() - access.verifiedAt) < (REVERIFY_AFTER_MS * 7);

}

export function getAccessEmail() {

    const access = load("access", null);

    return access?.email || null;

}

function setAccess(email) {

    save("access", {

        email,
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

export async function restoreAccess(email) {

    const res = await fetch("/api/verify-access", {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })

    });

    if (!res.ok) {

        return false;

    }

    const data = await res.json();

    if (data.active) {

        setAccess(email);

        return true;

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

                setAccess(data.email);

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

export async function reverifyIfStale() {

    const access = load("access", null);

    if (!access || !access.email) return;

    if (Date.now() - access.verifiedAt < REVERIFY_AFTER_MS) return;

    try {

        const active = await restoreAccess(access.email);

        if (!active) {

            clearAccess();

        }

    } catch {

        // network hiccup - keep cached access, try again next load

    }

}
