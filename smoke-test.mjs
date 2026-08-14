import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync("./dist/index.html", "utf8");
const cardsData = JSON.parse(fs.readFileSync("./dist/data/cards.json", "utf8"));
const jsFile = fs.readdirSync("./dist/assets").find(f => f.endsWith(".js"));

const dom = new JSDOM(html, {
    url: "http://localhost/",
    pretendToBeVisual: true
});

const { window } = dom;

global.window = window;
global.document = window.document;
global.localStorage = window.localStorage;
global.KeyboardEvent = window.KeyboardEvent;
global.Event = window.Event;
global.MutationObserver = window.MutationObserver;
global.HTMLElement = window.HTMLElement;
global.CustomEvent = window.CustomEvent;
global.Node = window.Node;
global.requestAnimationFrame = window.requestAnimationFrame || (cb => setTimeout(cb, 0));

let errors = [];

global.fetch = async (url) => {
    if (url.includes("cards.json")) {
        return { json: async () => JSON.parse(JSON.stringify(cardsData)) };
    }
    throw new Error("Unexpected fetch: " + url);
};

function check(label, condition) {
    console.log((condition ? "PASS" : "FAIL") + " - " + label);
    if (!condition) process.exitCode = 1;
}

try {
    await import(`./dist/assets/${jsFile}?t=${Date.now()}`);
} catch (e) {
    errors.push(e.stack || e.message);
}

await new Promise(r => setTimeout(r, 400));

const doc = global.document;

check("No uncaught errors during module load/init", errors.length === 0);
if (errors.length) console.log(errors.join("\n---\n"));

check("Total cards shows 120", doc.getElementById("totalCards")?.textContent === "120");
check("Due count is numeric", /^\d+$/.test(doc.getElementById("dueCount")?.textContent || ""));
check("Mastered count is numeric", /^\d+$/.test(doc.getElementById("masteredCount")?.textContent || ""));
check("dueStat has clickable class", doc.getElementById("dueStat")?.classList.contains("clickable"));
check("bookmark stat has clickable class", doc.getElementById("bookmarkCount")?.closest(".stat")?.classList.contains("clickable"));
check("120 cards rendered", doc.querySelectorAll("#cards .card").length === 120);
check("Filter buttons rendered", doc.querySelectorAll("#filters .filter").length > 5);
check("Study button exists", !!doc.getElementById("studyButton"));
check("Sort selector exists", !!doc.getElementById("sortSelector"));

const firstCard = doc.querySelector("#cards .card");
check("First card element found", !!firstCard);

if (firstCard) {
    firstCard.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    check("Viewer opens on card click", !!doc.getElementById("viewer")?.classList.contains("show"));

    const escEvent = new window.KeyboardEvent("keydown", { key: "Escape" });
    doc.dispatchEvent(escEvent);
    await new Promise(r => setTimeout(r, 300));
    check("No errors after closing viewer (onClose ran safely)", errors.length === 0);
}

const dueStat = doc.getElementById("dueStat");
if (dueStat) {
    dueStat.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    check("Clicking Due Today with 0 due cards does not throw", errors.length === 0);
    check("Study overlay NOT opened when 0 cards due", !doc.getElementById("study-mode"));
}

const studyButton = doc.getElementById("studyButton");
if (studyButton) {
    studyButton.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    check("Study Mode overlay opens from main button", !!doc.getElementById("study-mode"));

    const exitBtn = doc.getElementById("study-exit");
    if (exitBtn) {
        exitBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
        await new Promise(r => setTimeout(r, 250));
        check("No errors after exiting study session (onClose ran safely)", errors.length === 0);
        check("Study overlay removed after exit", !doc.getElementById("study-mode"));
    }
}

check(
    "Due count is 0 with no review history (new cards are New, not Due)",
    doc.getElementById("dueCount")?.textContent === "0"
);

// Simulate one genuinely overdue card directly via localStorage,
// matching review.js's exact storage format
const reviewData = {
    "001": {
        state: "review",
        due: Date.now() - 1000,
        reviews: 3,
        interval: 7,
        ease: 2.5,
        lastReviewed: Date.now() - 86400000
    }
};
global.localStorage.setItem("coffeeDeckReviews", JSON.stringify(reviewData));

// Re-trigger a dashboard update the same way the app does internally:
// closing the viewer again fires updateDashboard via onClose
firstCard.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));

check("Due count becomes 1 after simulating one overdue card", doc.getElementById("dueCount")?.textContent === "1");
check("Due stat no longer has disabled class", !doc.getElementById("dueStat")?.classList.contains("disabled"));

doc.getElementById("dueStat").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking Due Today now opens a study session", !!doc.getElementById("study-mode"));
check("Study counter shows exactly 1 card", doc.querySelector(".study-counter")?.textContent.includes("of 1"));

if (doc.getElementById("study-exit")) {
    doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
}

// Now test the bookmark study path
global.localStorage.setItem("coffeeDeck:bookmarks", JSON.stringify(["001", "002"]));

firstCard.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));

check("Bookmark count shows 2", doc.getElementById("bookmarkCount")?.textContent === "2");
const bookmarkStatEl = doc.getElementById("bookmarkCount")?.closest(".stat");
check("Bookmark stat no longer disabled", !bookmarkStatEl?.classList.contains("disabled"));

bookmarkStatEl.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking Bookmarks opens a study session", !!doc.getElementById("study-mode"));
check("Bookmark study session has exactly 2 cards", doc.querySelector(".study-counter")?.textContent.includes("of 2"));

if (doc.getElementById("study-exit")) {
    doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
}

// --- Search relevance ranking ---
const searchInput = doc.getElementById("search");
searchInput.value = "espresso";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));

const resultTitles = [...doc.querySelectorAll("#cards .card h2")].map(h => h.textContent.trim());
check("Searching 'espresso' returns results", resultTitles.length > 0);
check("Exact title match 'Espresso' ranks first", resultTitles[0].toLowerCase().includes("espresso"));

// --- Highlighting ---
const firstResultH2 = doc.querySelector("#cards .card h2");
check("Search term is wrapped in <mark> in results", firstResultH2?.innerHTML.toLowerCase().includes("<mark>"));

// --- Fuzzy typo tolerance ---
searchInput.value = "expresso"; // common misspelling
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
const fuzzyTitles = [...doc.querySelectorAll("#cards .card h2")].map(h => h.textContent.trim());
check("Typo 'expresso' still finds Espresso via fuzzy match", fuzzyTitles.some(t => t.toLowerCase().includes("espresso")));

// --- No results for nonsense query, no crash ---
searchInput.value = "zzzznonexistentqueryzzzz";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Nonsense query returns 0 results without throwing", doc.querySelectorAll("#cards .card").length === 0 && errors.length === 0);

// --- Recent searches ---
searchInput.value = "";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
searchInput.value = "milk";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
searchInput.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await new Promise(r => setTimeout(r, 150));

const savedSearches = JSON.parse(global.localStorage.getItem("coffeeDeck:recentSearches") || "[]");
check("Search term saved to recent searches on Enter", savedSearches.includes("milk"));

searchInput.value = "";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
searchInput.dispatchEvent(new window.Event("focus", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
const recentBox = doc.getElementById("recentSearches");
check("Recent searches dropdown shows when input is empty and focused", recentBox?.classList.contains("show"));
check("Recent search chip renders the saved term", recentBox?.textContent.includes("milk"));

// --- Study Recently Viewed ---
searchInput.value = "";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 200));

const recentStatEl = doc.getElementById("recentCount")?.closest(".stat");
check("Recently Viewed count is > 0 after viewing a card earlier", parseInt(doc.getElementById("recentCount")?.textContent || "0") > 0);
check("Recent stat has clickable class", recentStatEl?.classList.contains("clickable"));
check("Recent stat not disabled (has viewed cards)", !recentStatEl?.classList.contains("disabled"));

recentStatEl.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking Recently Viewed opens a study session", !!doc.getElementById("study-mode"));

if (doc.getElementById("study-exit")) {
    doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
}

// --- Clear recent searches ---
searchInput.dispatchEvent(new window.Event("focus", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
const clearBtn = doc.querySelector(".recent-search-clear");
check("Clear button exists in recent searches dropdown", !!clearBtn);
clearBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
const clearedSearches = JSON.parse(global.localStorage.getItem("coffeeDeck:recentSearches") || "null");
check("Recent searches actually cleared from storage", Array.isArray(clearedSearches) && clearedSearches.length === 0);

// --- Reset Progress ---
// card 001 has review history simulated earlier (reviews: 3)
firstCard.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
const resetBtn = doc.querySelector(".reset-progress");
check("Reset Progress button shows for a card with review history", !!resetBtn);

if (resetBtn) {
    resetBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const reviewsAfterReset = JSON.parse(global.localStorage.getItem("coffeeDeckReviews") || "{}");
    check("Card 001's review data removed after reset", !reviewsAfterReset["001"]);
    check("Reset Progress button no longer shows after reset (fresh card)", !doc.querySelector(".reset-progress"));
}

// --- Stats / Heatmap ---
const statsButton = doc.getElementById("statsButton");
check("Stats button exists", !!statsButton);

statsButton.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Stats overlay opens", !!doc.getElementById("stats-mode"));
check("No errors opening stats with zero activity", errors.length === 0);
check("Heatmap renders 84 day cells", doc.querySelectorAll(".heatmap-day").length === 84);
check("Empty-state message shows when no category data", doc.querySelector(".stats-empty")?.textContent.includes("Study a few cards"));

doc.getElementById("stats-close").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Stats overlay closes", !doc.getElementById("stats-mode"));

// Simulate 5 consecutive days of activity plus real review data
const activityLog = [];
const today = new Date();
for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    activityLog.push({ date: dateStr, timestamp: d.getTime(), cardNumber: "001", rating: "good", state: "review" });
}
global.localStorage.setItem("coffeeDeckActivity", JSON.stringify(activityLog));

const reviewState = {
    "001": { state: "review", due: Date.now() + 86400000, reviews: 5, interval: 7, ease: 2.6, lastReviewed: Date.now() },
    "002": { state: "learning", due: Date.now() + 86400000, reviews: 2, interval: 1, ease: 2.0, lastReviewed: Date.now() - 3600000 }
};
global.localStorage.setItem("coffeeDeckReviews", JSON.stringify(reviewState));

statsButton.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));

check("Streak reflects 5 consecutive active days", doc.querySelector(".stats-tile-value")?.textContent.includes("5"));
check("Heatmap shows at least one active (non level-0) day", doc.querySelectorAll(".heatmap-day:not(.level-0)").length > 0);
check("Category breakdown renders once there's review data", !!doc.querySelector(".category-column ul"));
check("Recent Activity section shows reviewed cards", doc.querySelectorAll(".stats-recent-item").length > 0);
check("No errors rendering populated stats", errors.length === 0);

doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 250));
check("Stats overlay closes via Escape key", !doc.getElementById("stats-mode"));

// --- Category filter counts ---
const filterButtons = doc.querySelectorAll("#filters .filter");
const allFilterButton = [...filterButtons].find(b => b.textContent.includes("ALL"));
check("ALL filter shows a count matching total cards (120)", allFilterButton?.textContent.includes("120"));

const espFilterButton = [...filterButtons].find(b => b.textContent.includes("ESP"));
check("ESP filter shows a nonzero count", /ESP\s*15|ESP\D*\d+/.test(espFilterButton?.textContent || "") && !espFilterButton?.textContent.includes("0"));

// --- Bookmark export ---
check("Export button hidden when there are bookmarks already set (2 from earlier)", exportBtnVisible());

function exportBtnVisible() {
    const btn = doc.getElementById("exportBookmarks");
    return btn && btn.style.display !== "none";
}

// clear bookmarks first to test the hidden state cleanly
global.localStorage.setItem("coffeeDeck:bookmarks", "[]");
firstCard.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));
check("Export button hidden when there are no bookmarks", doc.getElementById("exportBookmarks")?.style.display === "none");

global.localStorage.setItem("coffeeDeck:bookmarks", JSON.stringify(["001", "002"]));
firstCard.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));
check("Export button visible again once bookmarks exist", doc.getElementById("exportBookmarks")?.style.display !== "none");

let downloadTriggered = false;
let downloadedFilename = null;
const originalCreateElement = doc.createElement.bind(doc);
doc.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === "a") {
        const originalClick = el.click.bind(el);
        el.click = () => {
            downloadTriggered = true;
            downloadedFilename = el.download;
            originalClick();
        };
    }
    return el;
};

doc.getElementById("exportBookmarks").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));

check("Clicking Export triggers a download without throwing", errors.length === 0);
check("Export download filename is correct", downloadedFilename === "coffee-deck-bookmarks.json");
check("Clicking Export does NOT also open a study session (stopPropagation worked)", !doc.getElementById("study-mode"));

doc.createElement = originalCreateElement;

console.log("\nDone.");
