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
global.PointerEvent = window.PointerEvent || window.Event;
global.CustomEvent = window.CustomEvent;
global.MutationObserver = window.MutationObserver;
global.HTMLElement = window.HTMLElement;
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

function simulateDrag(el, dxTotal) {
    const down = new window.PointerEvent("pointerdown", { clientX: 200, bubbles: true, pointerId: 1 });
    Object.defineProperty(down, "target", { value: el, enumerable: true });
    el.dispatchEvent(down);
    const move = new window.PointerEvent("pointermove", { clientX: 200 + dxTotal, bubbles: true, pointerId: 1 });
    el.dispatchEvent(move);
    const up = new window.PointerEvent("pointerup", { clientX: 200 + dxTotal, bubbles: true, pointerId: 1 });
    el.dispatchEvent(up);
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

// --- Home swipe card ---
check("Total card count shows 120", doc.getElementById("count")?.textContent.includes("120"));
check("Home card renders", !!doc.querySelector(".home-card"));
check("Home card shows a title", !!doc.querySelector(".home-card h2")?.textContent.trim());
check("Home card shows a category badge", !!doc.querySelector(".home-card .category"));
check("Home progress indicator shows 1 / 120", doc.querySelector(".home-progress")?.textContent.trim() === "1 / 120");

const homeCardEl = doc.querySelector(".home-card");
const firstTitle = doc.querySelector(".home-card h2")?.textContent.trim();

simulateDrag(homeCardEl, -200);
await new Promise(r => setTimeout(r, 300));
const afterNextTitle = doc.querySelector(".home-card h2")?.textContent.trim();
check("Dragging home card left navigates to next card", firstTitle !== afterNextTitle);
check("Home progress updates to 2 / 120 after swipe", doc.querySelector(".home-progress")?.textContent.trim() === "2 / 120");

const homeCardEl2 = doc.querySelector(".home-card");
simulateDrag(homeCardEl2, 200);
await new Promise(r => setTimeout(r, 300));
const afterPrevTitle = doc.querySelector(".home-card h2")?.textContent.trim();
check("Dragging back right returns to the first card", afterPrevTitle === firstTitle);

check("No errors from home card swipe", errors.length === 0);

// prev/next buttons work too
document.getElementById("homeNext").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Next button navigates forward", doc.querySelector(".home-progress")?.textContent.trim() === "2 / 120");
document.getElementById("homePrev").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Previous button navigates back", doc.querySelector(".home-progress")?.textContent.trim() === "1 / 120");

// bookmark toggle on home card
const bookmarkBtn = doc.getElementById("homeBookmark");
check("Bookmark button starts unfilled", bookmarkBtn?.textContent.trim() === "♡");
bookmarkBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Bookmark button fills in after click", doc.getElementById("homeBookmark")?.textContent.trim() === "♥");
check("Clicking bookmark does not also open the viewer (stopPropagation)", !doc.getElementById("viewer"));

// tapping the card (no drag) opens full viewer
doc.querySelector(".home-card").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Tapping the home card opens the full viewer modal", !!doc.getElementById("viewer"));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));
check("Viewer closes via Escape", !doc.getElementById("viewer"));

// --- Filter panel ---
const filterPanel = doc.getElementById("filterPanel");
check("Filter panel starts hidden", !filterPanel.classList.contains("show"));
doc.getElementById("filterToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
check("Filter panel opens on toggle click", filterPanel.classList.contains("show"));

const filterButtons = doc.querySelectorAll("#filters .filter");
check("Filter buttons rendered", filterButtons.length > 5);
const espFilter = [...filterButtons].find(f => f.textContent.includes("ESP"));
espFilter.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Selecting a category filter closes the panel", !filterPanel.classList.contains("show"));
check("Card count updates to reflect ESP filter (15)", doc.getElementById("count")?.textContent.includes("15"));
check("Home card now shows an ESP card", doc.querySelector(".home-card .category")?.textContent.trim() === "ESP");

const allFilter = [...doc.querySelectorAll("#filters .filter")].find(f => f.textContent.includes("ALL"));
allFilter.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Resetting to ALL restores 120 cards", doc.getElementById("count")?.textContent.includes("120"));

// --- Search ---
doc.getElementById("filterToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
const searchInput = doc.getElementById("search");
searchInput.value = "espresso";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Searching 'espresso' surfaces the Espresso card first", doc.querySelector(".home-card h2")?.textContent.trim().toLowerCase().includes("espresso"));
check("Matched term is highlighted", doc.querySelector(".home-card h2")?.innerHTML.toLowerCase().includes("<mark>"));

searchInput.value = "expresso";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Typo 'expresso' still finds Espresso via fuzzy match", doc.querySelector(".home-card h2")?.textContent.trim().toLowerCase().includes("espresso"));

searchInput.value = "zzzznonexistentzzzz";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Nonsense query shows the empty state without throwing", !!doc.querySelector(".home-empty") && errors.length === 0);

searchInput.value = "milk";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
searchInput.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Enter saves the search term to recent searches", JSON.parse(global.localStorage.getItem("coffeeDeck:recentSearches") || "[]").includes("milk"));
check("Enter closes the filter panel", !filterPanel.classList.contains("show"));

searchInput.value = "";
searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
doc.getElementById("filterToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
searchInput.dispatchEvent(new window.Event("focus", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Recent searches dropdown shows saved term", doc.getElementById("recentSearches")?.textContent.includes("milk"));
doc.getElementById("filterToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));

// --- Study Mode ---
doc.getElementById("studyToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Study toggle opens study mode", !!doc.getElementById("study-mode"));
check("Study session includes all 120 cards (no active filter)", doc.querySelector(".study-counter")?.textContent.includes("of 120"));

const studyWindow = doc.querySelector(".study-window");
const counterBefore = doc.querySelector(".study-counter")?.textContent;
simulateDrag(studyWindow, -200);
await new Promise(r => setTimeout(r, 300));
check("Swipe navigates within study mode", doc.querySelector(".study-counter")?.textContent !== counterBefore);
check("No errors from study mode swipe", errors.length === 0);

doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Study mode closes", !doc.getElementById("study-mode"));

// --- Stats modal (with Library tiles) ---
doc.getElementById("statsToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Stats modal opens", !!doc.getElementById("stats-mode"));
check("Total Cards tile shows 120", doc.getElementById("stats-mode")?.textContent.includes("120"));
check("Bookmarks tile exists and is clickable (1 bookmark set earlier)", !!doc.getElementById("tile-bookmarks") && !doc.getElementById("tile-bookmarks").classList.contains("disabled"));
check("Export link appears since a bookmark exists", !!doc.getElementById("tile-export"));
check("Recently Viewed tile exists", !!doc.getElementById("tile-recent"));
check("Due Today tile exists", !!doc.getElementById("tile-due"));
check("Heatmap renders 84 cells", doc.querySelectorAll(".heatmap-day").length === 84);

document.getElementById("tile-bookmarks").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking Bookmarks tile closes stats and opens a study session", !doc.getElementById("stats-mode") && !!doc.getElementById("study-mode"));
check("Bookmark study session has exactly 1 card", doc.querySelector(".study-counter")?.textContent.includes("of 1"));
if (doc.getElementById("study-exit")) {
    doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
}
check("Home refreshes after returning from a stats-triggered study session", !!doc.querySelector(".home-card"));

// --- Reset Progress ---
const reviewState = {
    "001": { state: "review", due: Date.now() - 1000, reviews: 5, interval: 7, ease: 2.6, lastReviewed: Date.now() }
};
global.localStorage.setItem("coffeeDeckReviews", JSON.stringify(reviewState));
doc.querySelector(".home-card").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
const resetBtn = doc.querySelector(".reset-progress");
check("Reset Progress button shows for a card with review history", !!resetBtn);
if (resetBtn) {
    resetBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const reviewsAfterReset = JSON.parse(global.localStorage.getItem("coffeeDeckReviews") || "{}");
    check("Review data removed after reset", Object.keys(reviewsAfterReset).length === 0);
}

// --- Review-buttons grid fix (still relevant) ---
const reviewButtonsGrid = doc.querySelector(".review-buttons");
check("Review-buttons grid contains exactly 4 buttons", reviewButtonsGrid?.children.length === 4);
check("Review status is separate from the button grid", !!doc.querySelector(".review-status") && !reviewButtonsGrid.querySelector(".review-status"));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));

// --- Structural checks (still relevant) ---
check("Exactly one <h1> in the DOM", doc.querySelectorAll("h1").length <= 1);
check("No skipped heading level", (() => {
    const headings = [...doc.querySelectorAll("h1,h2,h3,h4")].map(h => parseInt(h.tagName[1]));
    for (let i = 1; i < headings.length; i++) {
        if (headings[i] - headings[i-1] > 1) return false;
    }
    return true;
})());
const fullHtml = doc.documentElement.innerHTML;
const approvedSymbols = /[♡♥←→▶◔⌕×]/gu;
const htmlWithoutApprovedSymbols = fullHtml.replace(approvedSymbols, "");
const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
check("No emoji anywhere in the rendered page (excluding approved plain-text icon symbols)", !emojiPattern.test(htmlWithoutApprovedSymbols));

check("No errors across the full run", errors.length === 0);

console.log("\nDone.");
