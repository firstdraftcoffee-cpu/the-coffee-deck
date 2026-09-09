import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync("./dist/index.html", "utf8");
const cardsData = JSON.parse(fs.readFileSync("./dist/data/cards.json", "utf8"));
const TOTAL_CARDS = String(cardsData.length);
const jsFile = fs.readdirSync("./dist/assets").find(f => f.startsWith("main-") && f.endsWith(".js"));

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

global.fetch = async (url, options) => {
    if (url.includes("cards.json")) {
        return { json: async () => JSON.parse(JSON.stringify(cardsData)) };
    }
    if (url.includes("/api/verify-access")) {
        const body = JSON.parse(options?.body || "{}");
        const active = body.email === "subscriber@example.com";
        return { ok: true, json: async () => ({ active, email: body.email }) };
    }
    if (url.includes("/api/create-checkout-session")) {
        return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/mock-session" }) };
    }
    // Vite's own module-preload helper fires a fetch() alongside the real
    // dynamic import() for cross-chunk dependencies (a real-browser
    // performance optimization) — harmless, just let it resolve.
    if (url.includes("/assets/") && (url.endsWith(".js") || url.endsWith(".css"))) {
        return { ok: true, json: async () => ({}) };
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

global.localStorage.setItem("coffeeDeck:access", JSON.stringify({ email: "test@example.com", verifiedAt: Date.now() }));

// Boots a fresh JSDOM instance of index.html at a given URL (used to test
// the ?card=NNN deep-link feature, which replaced search as the way to
// reach a specific known card for testing card-specific behavior — e.g.
// a cultivar's photo disclaimer, or the recipe calculator on a REC card).
async function bootIndex(url) {

    const bootDom = new JSDOM(html, { url, pretendToBeVisual: true });
    const bootWindow = bootDom.window;

    global.window = bootWindow;
    global.document = bootWindow.document;
    global.localStorage = bootWindow.localStorage;
    global.KeyboardEvent = bootWindow.KeyboardEvent;
    global.Event = bootWindow.Event;
    global.PointerEvent = bootWindow.PointerEvent || bootWindow.Event;
    global.CustomEvent = bootWindow.CustomEvent;
    global.MutationObserver = bootWindow.MutationObserver;
    global.HTMLElement = bootWindow.HTMLElement;
    global.Node = bootWindow.Node;
    global.requestAnimationFrame = bootWindow.requestAnimationFrame || (cb => setTimeout(cb, 0));

    global.localStorage.setItem("coffeeDeck:access", JSON.stringify({ email: "test@example.com", verifiedAt: Date.now() }));

    try {
        await import(`./dist/assets/${jsFile}?t=${Date.now()}-${Math.random()}`);
    } catch (e) {
        errors.push(e.stack || e.message);
    }

    await new Promise(r => setTimeout(r, 400));

    return { doc: global.document, window: global.window };

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

// --- Welcome overlay: shows every time the site loads, dismiss it like a real user would ---
check("Welcome overlay shows on page load", !!doc.getElementById("welcome-mode"));
check("Body scroll is locked while the welcome overlay is open", doc.body.style.position === "fixed");
check("Welcome overlay includes a landing image", !!doc.querySelector(".welcome-hero img")?.getAttribute("src"));
check("Welcome copy refers to 'enthusiasts', not 'professionals'", doc.getElementById("welcome-mode")?.textContent.includes("enthusiasts") && !doc.getElementById("welcome-mode")?.textContent.includes("professionals"));
doc.getElementById("welcome-cta")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Welcome overlay closes on Get Started", !doc.getElementById("welcome-mode")?.classList.contains("show"));
check("Body scroll unlocks after dismissing the welcome overlay", doc.body.style.position !== "fixed");

// --- Nav buttons have visible text labels, not just ambiguous icons ---
check("Search button has a visible text label", doc.getElementById("filterToggle")?.textContent.includes("Search"));
check("Study button has a visible text label", doc.getElementById("studyToggle")?.textContent.includes("Study"));
check("Progress button has a visible text label", doc.getElementById("statsToggle")?.textContent.includes("Progress"));

// --- Home swipe card ---
check(`Total card count shows ${TOTAL_CARDS}`, doc.getElementById("count")?.textContent.includes(TOTAL_CARDS));
check("Home card renders", !!doc.querySelector(".home-card"));
check("Home card shows a title", !!doc.querySelector(".home-card h2")?.textContent.trim());
const homeImg = doc.querySelector(".home-card-image img");
check("Home card renders an actual <img> for a card with a photo", !!homeImg && homeImg.getAttribute("src")?.includes(".jpg"));
check("Home card image does not use a negative z-index (regression: this hid the photo behind the card's own background)", global.window.getComputedStyle(homeImg).zIndex !== "-1");
check("Home card has a dedicated scrim layer distinct from the image itself", !!doc.querySelector(".home-card-scrim"));
check("Home card shows a category badge", !!doc.querySelector(".home-card .home-card-cat"));
check(`Home card data-total reflects ${TOTAL_CARDS} cards (not shown visibly, just for verification)`, doc.querySelector(".home-card")?.dataset.total === TOTAL_CARDS);
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

// --- Full card viewer: Challenge section includes a self-check hint, distinct from the prompt itself ---
doc.querySelector(".home-card")?.dispatchEvent(new global.window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
const challengeHintEl = doc.querySelector(".challenge-hint");
check("Viewer's Challenge section shows a hint explaining there's no stored answer", !!challengeHintEl && challengeHintEl.textContent.trim().length > 0);
check("The challenge hint text is distinct from the card's own challenge prompt text", challengeHintEl?.nextElementSibling?.textContent.trim() !== challengeHintEl?.textContent.trim());
doc.querySelector(".close")?.dispatchEvent(new global.window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));

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

// --- Search moved to a dedicated page (search.html) — verify the nav link ---
check("Search nav button links to the dedicated search page", doc.getElementById("filterToggle")?.getAttribute("href") === "search.html");

// Reset home position back to card 001 — the swipe/flick tests above leave
// homeIndex drifted forward by one, and several tests below assume a known
// starting card (previously reset implicitly by the old filter panel's
// "ALL" click, which no longer exists).
doc.getElementById("homeButton").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
doc.getElementById("welcome-cta")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));

// --- Study Mode ---
doc.getElementById("studyToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Study toggle opens study mode", !!doc.getElementById("study-mode"));
check("Body scroll is locked during study mode too", doc.body.style.position === "fixed");
check(`Study session includes all ${TOTAL_CARDS} cards (no active filter)`, doc.querySelector(".study-window")?.dataset.total === TOTAL_CARDS);
check("No visible 'Card X of Y' counter text in study mode", !/Card\s+\d+\s+of\s+\d+/.test(doc.querySelector(".study-window")?.textContent || ""));

const studyWindow = doc.querySelector(".study-window");
const counterBefore = doc.querySelector(".study-window")?.dataset.index;
simulateDrag(studyWindow, -200);
await new Promise(r => setTimeout(r, 300));
check("Swipe navigates within study mode", doc.querySelector(".study-window")?.dataset.index !== counterBefore);
check("Body scroll stays locked during internal navigation (no flicker)", doc.body.style.position === "fixed");
check("No errors from study mode swipe", errors.length === 0);

// --- Typed answer in Study Mode ---
const answerBox = doc.getElementById("study-answer-input");
check("Study Mode shows a textarea to type your own answer before revealing", !!answerBox);
answerBox.value = "My own test answer <script>";
answerBox.dispatchEvent(new window.Event("input", { bubbles: true }));
doc.getElementById("study-reveal").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Typed answer appears in a 'Your answer' section after reveal", doc.querySelector(".study-your-answer")?.textContent.includes("My own test answer"));
check("Typed answer is HTML-escaped, not executed as markup", !doc.querySelector(".study-your-answer script"));
doc.getElementById("study-reveal").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Typed answer persists in the textarea after hiding again", doc.getElementById("study-answer-input")?.value.includes("My own test answer"));

const answerBoxAtSpace = doc.getElementById("study-answer-input");
answerBoxAtSpace.focus();
answerBoxAtSpace.dispatchEvent(new window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
await new Promise(r => setTimeout(r, 100));
check("Pressing Space while typing an answer does not flip the card", !doc.querySelector(".study-your-answer"));

doc.getElementById("study-exit").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Study mode closes", !doc.getElementById("study-mode"));
check("Body scroll unlocks after study mode closes", doc.body.style.position !== "fixed");

// --- Recipe Cards: full viewer rendering (opened directly via ?card= deep-link) ---
{
    const { doc: recipeDoc } = await bootIndex("http://localhost/?card=234");
    check("Recipe card viewer shows stat pills (ratio/grind/temp/time)", recipeDoc.querySelectorAll(".recipe-stat").length === 4);
    check("Recipe card viewer shows the interactive ratio calculator", !!recipeDoc.querySelector(".recipe-calc"));
    check("Recipe card viewer shows a dial-in troubleshooting guide", recipeDoc.querySelectorAll(".recipe-dial-in dt").length > 0);
    check("Recipe card viewer shows numbered brewing steps", recipeDoc.querySelectorAll(".recipe-steps li").length > 0);
    check("At least one step shows a timer badge", !!recipeDoc.querySelector(".recipe-step-timer"));

    const resultBefore = recipeDoc.querySelector(".recipe-calc-result")?.textContent.trim();
    const doseSliderEl = recipeDoc.querySelector(".calc-dose-slider");
    doseSliderEl.value = String(Number(doseSliderEl.max));
    doseSliderEl.dispatchEvent(new global.window.Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const resultAfter = recipeDoc.querySelector(".recipe-calc-result")?.textContent.trim();
    check("Dragging the dose slider updates the water/yield result live", resultAfter !== resultBefore);
    check("Dose display next to the slider updates to match", recipeDoc.querySelector(".calc-dose-value")?.textContent === doseSliderEl.max);

    const ratioSliderEl = recipeDoc.querySelector(".calc-ratio-slider");
    ratioSliderEl.value = ratioSliderEl.min;
    ratioSliderEl.dispatchEvent(new global.window.Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    check("Dragging the ratio slider updates the displayed ratio", recipeDoc.querySelector(".calc-ratio-value")?.textContent === `1:${ratioSliderEl.min}`);

    doseSliderEl.focus();
    doseSliderEl.dispatchEvent(new global.window.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    check("Arrow keys while a slider is focused do not navigate away from the card", !!recipeDoc.querySelector(".recipe-calc"));

    recipeDoc.querySelector(".close")?.dispatchEvent(new global.window.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    check("Recipe card viewer closes normally", !recipeDoc.getElementById("viewer")?.classList.contains("show"));
}

// Restore the main default-boot doc/window/localStorage as globals for subsequent tests
global.document = doc;
global.window = window;
global.localStorage = window.localStorage;


// --- Stats modal (with Library tiles) ---
doc.getElementById("statsToggle").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 200));
check("Stats modal opens", !!doc.getElementById("stats-mode"));
check("Body scroll is locked during stats modal too", doc.body.style.position === "fixed");
check(`Total Cards tile shows ${TOTAL_CARDS}`, doc.getElementById("stats-mode")?.textContent.includes(TOTAL_CARDS));
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

// --- Cultivar cards show a discreet "photo not verified" disclaimer ---
{
    const { doc: typicaDoc } = await bootIndex("http://localhost/?card=139");
    check("Cultivar card shows the photo-unverified disclaimer under its image", !!typicaDoc.querySelector(".viewer-photo-note")?.textContent.trim());
}

{
    const { doc: espressoDoc } = await bootIndex("http://localhost/?card=001");
    check("Non-cultivar card does NOT show the photo-unverified disclaimer", !espressoDoc.querySelector(".viewer-photo-note"));
}

// --- Placeholder-flagged origin cards show a distinct disclaimer ---
{
    const { doc: yirgaDoc } = await bootIndex("http://localhost/?card=130");
    check("Placeholder-flagged origin card shows the placeholder disclaimer", yirgaDoc.querySelector(".viewer-photo-note")?.textContent.includes("placeholder"));
}

global.document = doc;
global.window = window;
global.localStorage = window.localStorage;

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
doc.querySelector(".home-card")?.dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Home button test setup: viewer is open before clicking home", !!doc.getElementById("viewer")?.classList.contains("show"));

doc.getElementById("homeButton").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));

check("Clicking the home button closes an open viewer", !doc.getElementById("viewer")?.classList.contains("show"));
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
const langButtons = () => [...doc.querySelectorAll("#langSwitch button")];
check("Language switcher renders EN/ES/PT/DE/FR/IT buttons", langButtons().length === 6);

const esButton = langButtons().find(b => b.textContent.trim() === "ES");
check("Spanish option exists in language switcher", !!esButton);

const deButton = langButtons().find(b => b.textContent.trim() === "DE");
check("German option exists in language switcher", !!deButton);

const frButton = langButtons().find(b => b.textContent.trim() === "FR");
check("French option exists in language switcher", !!frButton);

const itButton = langButtons().find(b => b.textContent.trim() === "IT");
check("Italian option exists in language switcher", !!itButton);

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

// =====================================================================
// FREE / PAYWALL EXPERIENCE - fresh JSDOM instance, no seeded access,
// so this exercises exactly what an unsubscribed visitor sees
// =====================================================================

const freeDom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
const freeWindow = freeDom.window;

global.window = freeWindow;
global.document = freeWindow.document;
global.localStorage = freeWindow.localStorage;
global.KeyboardEvent = freeWindow.KeyboardEvent;
global.Event = freeWindow.Event;
global.PointerEvent = freeWindow.PointerEvent || freeWindow.Event;
global.CustomEvent = freeWindow.CustomEvent;
global.MutationObserver = freeWindow.MutationObserver;
global.HTMLElement = freeWindow.HTMLElement;
global.Node = freeWindow.Node;
global.requestAnimationFrame = freeWindow.requestAnimationFrame || (cb => setTimeout(cb, 0));

let checkoutCalls = [];

global.fetch = async (url, options) => {
    if (url.includes("cards.json")) {
        return { json: async () => JSON.parse(JSON.stringify(cardsData)) };
    }
    if (url.includes("/api/verify-access")) {
        const body = JSON.parse(options?.body || "{}");
        const active = body.email === "subscriber@example.com";
        return { ok: true, json: async () => ({ active, email: body.email }) };
    }
    if (url.includes("/api/create-checkout-session")) {
        const body = JSON.parse(options?.body || "{}");
        checkoutCalls.push(body.plan);
        return { ok: true, json: async () => ({ url: "https://checkout.stripe.com/mock-session" }) };
    }
    throw new Error("Unexpected fetch: " + url);
};

try {
    await import(`./dist/assets/${jsFile}?t=${Date.now()}-free`);
} catch (e) {
    errors.push(e.stack || e.message);
}

await new Promise(r => setTimeout(r, 400));

const freeDoc = global.document;

check("Free/unsubscribed visitor: no errors during module load/init", errors.length === 0);

freeDoc.getElementById("welcome-cta")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));

check("Free visitor sees the reduced sample count, not the full deck", freeDoc.getElementById("count")?.textContent.includes("25") && !freeDoc.getElementById("count")?.textContent.includes(TOTAL_CARDS));

check("Free visitor sees a Subscribe button in the header", freeDoc.getElementById("subscribeToggle")?.hidden === false);

freeDoc.getElementById("subscribeToggle")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Clicking the header Subscribe button jumps straight to the paywall card", !!freeDoc.querySelector(".paywall-card"));

// Reset back to the first free card before continuing, so later tests' own navigation isn't affected
freeDoc.getElementById("homeButton")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));

// Swipe through all 25 free cards to reach the paywall card at the end
for (let i = 0; i < 25; i++) {
    freeDoc.getElementById("homeNext")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
    await new Promise(r => setTimeout(r, 80));
}

check("Reaching the end of the free sample shows the paywall card", !!freeDoc.querySelector(".paywall-card"));
check("Paywall card shows both a monthly and yearly plan", !!freeDoc.getElementById("paywall-monthly") && !!freeDoc.getElementById("paywall-yearly"));

freeDoc.getElementById("paywall-monthly")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Clicking Subscribe Monthly calls checkout with the monthly plan", checkoutCalls.includes("monthly"));

freeDoc.getElementById("paywall-yearly")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 150));
check("Clicking Subscribe Yearly calls checkout with the yearly plan", checkoutCalls.includes("yearly"));

freeDoc.getElementById("paywall-restore-toggle")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 100));
check("Restore-access form appears after clicking the link", freeDoc.getElementById("paywall-restore-form")?.hidden === false);

const emailInput = freeDoc.getElementById("paywall-email");
emailInput.value = "not-a-subscriber@example.com";
freeDoc.getElementById("paywall-verify")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Restoring access with an unknown email shows an error, deck stays locked", freeDoc.getElementById("paywall-status")?.textContent.length > 0 && freeDoc.getElementById("count")?.textContent.includes("25"));

emailInput.value = "subscriber@example.com";
freeDoc.getElementById("paywall-verify")?.dispatchEvent(new freeWindow.Event("click", { bubbles: true }));
await new Promise(r => setTimeout(r, 250));
check("Restoring access with a valid subscriber email unlocks the full deck", freeDoc.getElementById("count")?.textContent.includes(TOTAL_CARDS));
check("Header Subscribe button hides once access is restored", freeDoc.getElementById("subscribeToggle")?.hidden === true);

console.log("\nDone.");
