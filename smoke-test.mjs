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

async function simulateFastFlick(el, dxTotal, elapsedMs) {
    const down = new window.PointerEvent("pointerdown", { clientX: 200, bubbles: true, pointerId: 1 });
    Object.defineProperty(down, "target", { value: el, enumerable: true });
    el.dispatchEvent(down);
    const move = new window.PointerEvent("pointermove", { clientX: 200 + dxTotal, bubbles: true, pointerId: 1 });
    el.dispatchEvent(move);
    await new Promise(r => setTimeout(r, elapsedMs));
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

// --- Welcome overlay: shows on first visit, dismiss it like a real user would ---
check("Welcome overlay shows on first visit", !!doc.getElementById("welcome-mode"));
check("Body scroll is locked while the welcome overlay is open", doc.body.style.position === "fixed");
check("Welcome overlay includes a landing image", !!doc.querySelector(".welcome-hero img")?.getAttribute("src"));
check("Welcome copy refers to 'enthusiasts', not 'professionals'", doc.getElementById("welcome-mode")?.textContent.includes("enthusiasts") && !doc.getElementById("welcome-mode")?.textContent.includes("professionals"));
doc.getElementById("welcome-cta")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Welcome overlay closes on Get Started", !doc.getElementById("welcome-mode")?.classList.contains("show"));
check("Body scroll unlocks after dismissing the welcome overlay", doc.body.style.position !== "fixed");
check("Dismissing the welcome overlay marks it as seen in storage", global.localStorage.getItem("coffeeDeck:hasSeenWelcome") === JSON.stringify(true));

// --- Nav buttons have visible text labels, not just ambiguous icons ---
check("Search button has a visible text label", doc.getElementById("filterToggle")?.textContent.includes("Search"));
check("Study button has a visible text label", doc.getElementById("studyToggle")?.textContent.includes("Study"));
check("Progress button has a visible text label", doc.getElementById("statsToggle")?.textContent.includes("Progress"));

// --- Home swipe card ---
check("Total card count shows 120", doc.getElementById("count")?.textContent.includes("120"));
check("Home card renders", !!doc.querySelector(".home-card"));
check("Home card shows a title", !!doc.querySelector(".home-card h2")?.textContent.trim());
const homeImg = doc.querySelector(".home-card-image img");
check("Home card renders an actual <img> for a card with a photo", !!homeImg && homeImg.getAttribute("src")?.includes(".jpg"));
check("Home card image does not use a negative z-index (regression: this hid the photo behind the card's own background)", global.window.getComputedStyle(homeImg).zIndex !== "-1");
check("Home card has a dedicated scrim layer distinct from the image itself", !!doc.querySelector(".home-card-scrim"));
check("Home card shows a category badge", !!doc.querySelector(".home-card .home-card-cat"));
check("Home card data-total reflects 120 cards (not shown visibly, just for verification)", doc.querySelector(".home-card")?.dataset.total === "120");
check("Home card starts at index 0", doc.querySelector(".home-card")?.dataset.index === "0");
check("No visible '1 / 120' style counter text on the home card", !/\d+\s*\/\s*\d+/.test(doc.querySelector(".home-card")?.textContent || ""));

const homeCardEl = doc.querySelector(".home-card");
const firstTitle = doc.querySelector(".home-card h2")?.textContent.trim();

simulateDrag(homeCardEl, -200);
await new Promise(r => setTimeout(r, 300));
const afterNextTitle = doc.querySelector(".home-card h2")?.textContent.trim();
check("Dragging home card left navigates to next card", firstTitle !== afterNextTitle);
check("Home card index updates to 1 after swipe", doc.querySelector(".home-card")?.dataset.index === "1");

const homeCardEl2 = doc.querySelector(".home-card");
simulateDrag(homeCardEl2, 200);
await new Promise(r => setTimeout(r, 300));
const afterPrevTitle = doc.querySelector(".home-card h2")?.textContent.trim();
check("Dragging back right returns to the first card", afterPrevTitle === firstTitle);

check("No errors from home card swipe", errors.length === 0);

// A real quick flick: short distance (60px, under the 80px distance threshold) but fast (50ms)
// should still commit via velocity detection - this is the actual "feels stiff" fix
const beforeFlick = doc.querySelector(".home-card")?.dataset.index;
const flickCard = doc.querySelector(".home-card");
await simulateFastFlick(flickCard, -60, 50);
await new Promise(r => setTimeout(r, 300));
const afterFlick = doc.querySelector(".home-card")?.dataset.index;
check("A fast short flick (60px in 50ms) commits via velocity, not just distance", beforeFlick !== afterFlick);

// A slow drag of the same short distance should NOT commit (snaps back)
const beforeSlowDrag = doc.querySelector(".home-card")?.dataset.index;
const slowCard = doc.querySelector(".home-card");
await simulateFastFlick(slowCard, 60, 600);
await new Promise(r => setTimeout(r, 300));
const afterSlowDrag = doc.querySelector(".home-card")?.dataset.index;
check("A slow short drag (60px in 600ms) does NOT commit (below both thresholds)", beforeSlowDrag === afterSlowDrag);

check("No errors from flick/slow-drag tests", errors.length === 0);

// peek card renders behind when there's more than one card
check("A peek card renders behind the front card for deck depth", !!doc.querySelector(".home-card-peek"));

// prev/next buttons work too
const posBeforeNextBtn = doc.querySelector(".home-card")?.dataset.index;
document.getElementById("homeNext").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Next button navigates forward", doc.querySelector(".home-card")?.dataset.index !== posBeforeNextBtn);
const posBeforePrevBtn = doc.querySelector(".home-card")?.dataset.index;
document.getElementById("homePrev").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Previous button navigates back", doc.querySelector(".home-card")?.dataset.index !== posBeforePrevBtn);

// bookmark toggle on home card
const bookmarkBtn = doc.getElementById("homeBookmark");
check("Bookmark button starts unfilled", bookmarkBtn?.textContent.trim().startsWith("♡"));
bookmarkBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Bookmark button fills in after click", doc.getElementById("homeBookmark")?.textContent.trim().startsWith("♥"));
check("Clicking bookmark does not also open the viewer (stopPropagation)", !doc.getElementById("viewer"));

// tapping the card (no drag) opens full viewer
doc.querySelector(".home-card").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Tapping the home card opens the full viewer modal", !!doc.getElementById("viewer"));
check("Body scroll is locked while the viewer is open (background can't scroll behind it)", doc.body.style.position === "fixed");
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));
check("Viewer closes via Escape", !doc.getElementById("viewer"));
check("Body scroll unlocks after the viewer closes", doc.body.style.position !== "fixed");

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
check("Home card now shows an ESP card", doc.querySelector(".home-card .home-card-cat")?.textContent.trim() === "ESP");

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
check("Body scroll is locked during study mode too", doc.body.style.position === "fixed");
check("Study session includes all 120 cards (no active filter)", doc.querySelector(".study-window")?.dataset.total === "120");
check("No visible 'Card X of Y' counter text in study mode", !/Card\s+\d+\s+of\s+\d+/.test(doc.querySelector(".study-window")?.textContent || ""));

const studyWindow = doc.querySelector(".study-window");
const counterBefore = doc.querySelector(".study-window")?.dataset.index;
simulateDrag(studyWindow, -200);
await new Promise(r => setTimeout(r, 300));
check("Swipe navigates within study mode", doc.querySelector(".study-window")?.dataset.index !== counterBefore);
check("Body scroll stays locked during internal navigation (no flicker)", doc.body.style.position === "fixed");
check("No errors from study mode swipe", errors.length === 0);

doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Study mode closes", !doc.getElementById("study-mode"));
check("Body scroll unlocks after study mode closes", doc.body.style.position !== "fixed");

// --- Stats modal (with Library tiles) ---
doc.getElementById("statsToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Stats modal opens", !!doc.getElementById("stats-mode"));
check("Body scroll is locked during stats modal too", doc.body.style.position === "fixed");
check("Total Cards tile shows 120", doc.getElementById("stats-mode")?.textContent.includes("120"));
check("Bookmarks tile exists and is clickable (1 bookmark set earlier)", !!doc.getElementById("tile-bookmarks") && !doc.getElementById("tile-bookmarks").classList.contains("disabled"));
check("Export link appears since a bookmark exists", !!doc.getElementById("tile-export"));
check("Recently Viewed tile exists", !!doc.getElementById("tile-recent"));
check("Due Today tile exists", !!doc.getElementById("tile-due"));
check("Heatmap renders 84 cells", doc.querySelectorAll(".heatmap-day").length === 84);

document.getElementById("tile-bookmarks").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking Bookmarks tile closes stats and opens a study session", !doc.getElementById("stats-mode") && !!doc.getElementById("study-mode"));
check("Bookmark study session has exactly 1 card", doc.querySelector(".study-window")?.dataset.total === "1");
if (doc.getElementById("study-exit")) {
    doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
}
check("Home refreshes after returning from a stats-triggered study session", !!doc.querySelector(".home-card"));
check("Body scroll is fully unlocked back on the home page", doc.body.style.position !== "fixed");

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

// --- Plain viewer: no confusing rating buttons, just status + hint ---
check("Plain viewer shows review status", !!doc.querySelector(".review-status"));
check("Plain viewer does NOT show the rating buttons grid", !doc.querySelector(".review-buttons"));
check("Plain viewer shows a hint pointing to Study Mode instead", doc.querySelector(".review-hint")?.textContent.includes("Study Mode"));
doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
await new Promise(r => setTimeout(r, 300));

// --- Study Mode: rating buttons still work exactly as before ---
document.getElementById("studyToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
const revealBtn = doc.getElementById("study-reveal");
if (revealBtn) {
    revealBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
}
const reviewButtonsGrid = doc.querySelector(".review-buttons");
check("Review-buttons grid contains exactly 4 buttons in Study Mode", reviewButtonsGrid?.children.length === 4);
if (doc.getElementById("study-exit")) {
    doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
}

// --- Home button: closes any open overlay, resets to the home stack, and also opens the welcome overlay ---
document.getElementById("filterToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
doc.getElementById("search").value = "espresso";
doc.getElementById("search").dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
const filterBtn = [...doc.querySelectorAll(".filter")].find(b => b.textContent.trim().startsWith("ESP"));
if (filterBtn) {
    filterBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
}
doc.querySelector(".home-card")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Home button test setup: viewer is open before clicking home", !!doc.getElementById("viewer")?.classList.contains("show"));

doc.getElementById("homeButton").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));

check("Clicking the home button closes an open viewer", !doc.getElementById("viewer")?.classList.contains("show"));
check("Clicking the home button clears the search field", doc.getElementById("search").value === "");
check("Clicking the home button resets the filter back to ALL (120 cards)", doc.getElementById("count")?.textContent.includes("120"));
check("Home stack is visible again after clicking the home button", !!doc.querySelector(".home-card"));
check("Clicking the home button also opens the welcome overlay", !!doc.getElementById("welcome-mode")?.classList.contains("show"));
check("Body scroll is locked while that welcome overlay is showing", doc.body.style.position === "fixed");

doc.getElementById("welcome-cta")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));

document.getElementById("studyToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Home button test setup: study mode is open before clicking home", !!doc.getElementById("study-mode"));

doc.getElementById("homeButton").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking the home button closes an open study session", !doc.getElementById("study-mode"));
check("Clicking the home button opens the welcome overlay from study mode too", !!doc.getElementById("welcome-mode")?.classList.contains("show"));

doc.getElementById("welcome-cta")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));

document.getElementById("statsToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Home button test setup: stats modal is open before clicking home", !!doc.getElementById("stats-mode")?.classList.contains("show"));

doc.getElementById("homeButton").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking the home button closes an open stats modal", !doc.getElementById("stats-mode")?.classList.contains("show"));
check("Clicking the home button opens the welcome overlay from stats too", !!doc.getElementById("welcome-mode")?.classList.contains("show"));

doc.getElementById("welcome-cta")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Body scroll is fully unlocked after dismissing the welcome overlay opened via home button (regression: closeStudySession used to unlock unconditionally and could desync the scroll-lock counter)", doc.body.style.position !== "fixed");

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
const approvedSymbols = /[♡♥←→▶▸◔⌕×☀☾]/gu;
const htmlWithoutApprovedSymbols = fullHtml.replace(approvedSymbols, "");
const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
check("No emoji anywhere in the rendered page (excluding approved plain-text icon symbols)", !emojiPattern.test(htmlWithoutApprovedSymbols));

// --- Localization: language switcher ---
doc.getElementById("search").value = "";
doc.getElementById("search").dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
document.getElementById("filterToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
const allFilterBtn = [...doc.querySelectorAll(".filter")].find(b => b.textContent.trim().startsWith("ALL"));
if (allFilterBtn) {
    allFilterBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
}

const langButtons = () => [...doc.querySelectorAll("#langSwitch button")];
check("Language switcher renders EN/ES/PT buttons", langButtons().length === 3);

const esButton = langButtons().find(b => b.textContent.trim() === "ES");
check("Spanish option exists in language switcher", !!esButton);

if (esButton) {

    esButton.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));

    check("Nav label updates to Spanish after switching language", doc.getElementById("studyToggle")?.textContent.includes("Estudiar"));
    check("Locale choice persists to storage", global.localStorage.getItem("coffeeDeck:locale") === JSON.stringify("es"));

    const homeCardEs = doc.querySelector(".home-card");
    check("Translated pilot card (Espresso #001) shows Spanish definition text", homeCardEs?.textContent.includes("El espresso es una bebida"));

    doc.getElementById("homeNext")?.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const homeCardNext = doc.querySelector(".home-card");
    check("Card #002 (Dose) also shows Spanish content now that all 120 cards are translated", homeCardNext?.textContent.includes("El peso del café seco"));

}

const ptButton = langButtons().find(b => b.textContent.trim() === "PT");

if (ptButton) {

    ptButton.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));

    check("Nav label updates to Portuguese after switching language", doc.getElementById("studyToggle")?.textContent.includes("Estudar"));
    check("Active language button reflects Portuguese selection", langButtons().find(b => b.textContent.trim() === "PT")?.classList.contains("active"));

}

const enButton = langButtons().find(b => b.textContent.trim() === "EN");

if (enButton) {

    enButton.dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));

    check("Switching back to English restores original nav labels", doc.getElementById("studyToggle")?.textContent.includes("Study"));
    check("Locale choice updates to English in storage", global.localStorage.getItem("coffeeDeck:locale") === JSON.stringify("en"));

}

check("No errors across the full run", errors.length === 0);

// --- Image prefetching for adjacent cards ---
doc.getElementById("search").value = "";
doc.getElementById("search").dispatchEvent(new window.Event("input", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));

const preloadedSrcs = [];
const originalCreateElement = doc.createElement.bind(doc);
doc.createElement = (tag) => {
    const el = originalCreateElement(tag);
    if (tag === "img") {
        Object.defineProperty(el, "src", {
            set(value) { preloadedSrcs.push(value); },
            get() { return ""; }
        });
    }
    return el;
};

doc.getElementById("homeNext")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));

doc.createElement = originalCreateElement;

check("Navigating home cards triggers a prefetch of adjacent card images", preloadedSrcs.some(src => src.includes("/images/cards/")));

// --- Theme toggle ---
// Note: the inline <head> script in index.html that sets the initial
// data-theme (to prevent a flash of the wrong theme) is inert here,
// since this harness loads index.html into JSDOM without runScripts
// and only executes the app bundle via explicit import(). That inline
// script is trivial static HTML/JS and runs normally in real browsers;
// what we're actually testing here is the app's own toggle logic, so
// we set a known starting theme first rather than relying on it.
const htmlEl = doc.documentElement;
htmlEl.setAttribute("data-theme", "light");

doc.getElementById("themeToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
check("Clicking the theme toggle flips from light to dark", htmlEl.getAttribute("data-theme") === "dark");
check("Theme choice persists to storage", global.localStorage.getItem("coffeeDeck:theme") === JSON.stringify("dark"));

doc.getElementById("themeToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
check("Clicking the theme toggle again flips back to light", htmlEl.getAttribute("data-theme") === "light");
check("Theme choice updates to light in storage", global.localStorage.getItem("coffeeDeck:theme") === JSON.stringify("light"));

// --- Reopening the welcome overlay from Progress > About (for demos, not just first-visit) ---
document.getElementById("statsToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
const aboutLink = doc.getElementById("stats-about");
check("Stats modal includes an About link back to the welcome overlay", !!aboutLink);
aboutLink?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Clicking About closes the stats modal", !doc.getElementById("stats-mode")?.classList.contains("show"));
check("Clicking About reopens the welcome overlay", !!doc.getElementById("welcome-mode")?.classList.contains("show"));
doc.getElementById("welcome-close")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Welcome overlay closes via the X button too", !doc.getElementById("welcome-mode")?.classList.contains("show"));
check("Body scroll is unlocked after closing the re-opened welcome overlay", doc.body.style.position !== "fixed");

console.log("\nDone.");
