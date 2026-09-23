import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync("./dist/search.html", "utf8");
import worker, { createPass } from "./worker/index.js";

const TEST_ENV = { STRIPE_SECRET_KEY: "sk_test_smoke", ASSETS: { fetch: async () => new Response("") } };
const freeDeck = lang => JSON.parse(fs.readFileSync(`./dist/data/deck/free-${lang}.json`, "utf8"));
const TOTAL = freeDeck("en").total;
const TEST_PASS = await createPass(TEST_ENV, "test@example.com");
const jsFile = fs.readdirSync("./dist/assets").find(f => f.startsWith("search-") && f.endsWith(".js"));

function check(label, condition) {
    console.log((condition ? "PASS" : "FAIL") + " - " + label);
    if (!condition) process.exitCode = 1;
}

const dom = new JSDOM(html, { url: "http://localhost/search.html", pretendToBeVisual: true });
const { window } = dom;

global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.KeyboardEvent = window.KeyboardEvent;
global.Event = window.Event;
global.CustomEvent = window.CustomEvent;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.MutationObserver = window.MutationObserver;
global.requestAnimationFrame = window.requestAnimationFrame || (cb => setTimeout(cb, 0));

const errors = [];
global.fetch = async (url, options) => {
    const freeMatch = url.match(/data\/deck\/free-(\w+)\.json/);
    if (freeMatch) { const data = freeDeck(freeMatch[1]); return { ok: true, json: async () => data }; }
    if (url.includes("/api/deck")) {
        const res = await worker.fetch(new Request(new URL(url, "http://localhost/"), { headers: options?.headers || {} }), TEST_ENV);
        const body = await res.text();
        return { ok: res.ok, status: res.status, json: async () => JSON.parse(body) };
    }
    if (url.includes("/api/verify-access")) return { ok: true, json: async () => ({ active: false }) };
    if (url.includes("/assets/") && (url.endsWith(".js") || url.endsWith(".css"))) return { ok: true, json: async () => ({}) };
    throw new Error("Unexpected fetch: " + url);
};

global.localStorage.setItem("coffeeDeck:access", JSON.stringify({ email: "test@example.com", pass: TEST_PASS, verifiedAt: Date.now() }));

try {
    await import(`./dist/assets/${jsFile}?t=${Date.now()}`);
} catch (e) {
    errors.push(e.stack || e.message);
}

await new Promise(r => setTimeout(r, 400));
const doc = global.document;

check("No errors during search page load/init", errors.length === 0);
if (errors.length) console.log(errors.join("\n---\n"));

check("Search input exists", !!doc.getElementById("search"));
check("Category list renders", doc.querySelectorAll(".category-pill").length === 29); // 28 categories + ALL
check("'All Categories' pill shown with full total", doc.querySelector(".category-pill")?.textContent.includes(String(TOTAL)));
check("Category pills use full display names, not abbreviations", [...doc.querySelectorAll(".category-pill")].some(p => p.textContent.includes("Espresso")));
check("No raw 3-letter category codes visible in pills (e.g. bare 'ESP')", ![...doc.querySelectorAll(".category-pill")].some(p => /^ESP\s/.test(p.textContent.trim())));
check("Results list renders all cards by default", doc.querySelectorAll(".result-card").length === TOTAL);
check("Result count text shows total", doc.getElementById("resultCount")?.textContent.includes(String(TOTAL)));

const search = doc.getElementById("search");
search.value = "espresso";
search.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 50));
check("Typing 'espresso' filters results down", doc.querySelectorAll(".result-card").length < TOTAL);
check("Espresso card appears in filtered results", [...doc.querySelectorAll(".result-title")].some(t => t.textContent.toLowerCase().includes("espresso")));
check("URL updates with the query as you type (bookmarkable)", new URL(window.location.href).searchParams.get("q") === "espresso");

const firstResult = doc.querySelector(".result-card");
check("Result links point to index.html?card=NNN", firstResult?.getAttribute("href")?.startsWith("index.html?card="));

search.value = "zzzznonexistentzzzz";
search.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 50));
check("Nonsense query shows the no-results state", !!doc.querySelector(".no-results"));

search.value = "";
search.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 50));

const espCategoryLink = [...doc.querySelectorAll(".category-pill")].find(p => p.textContent.includes("Espresso"));
check("Espresso category pill is a real link with category param", espCategoryLink?.getAttribute("href")?.includes("category=ESP"));

console.log("\nDone (search.html).");
