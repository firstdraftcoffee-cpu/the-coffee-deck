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

console.log("\nDone.");
