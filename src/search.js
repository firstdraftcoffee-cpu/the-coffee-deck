import {
    loadCards,
    searchCards,
    getCategories,
    allCards
} from "./cards.js";

import {
    reverifyIfStale
} from "./access.js";

import {
    save
} from "./storage.js";

// Full display names for category codes — used only here, on the
// dedicated search/browse page, so results read clearly rather than
// as bare 3-letter codes.
const CATEGORY_NAMES = {
    ESP: "Espresso",
    MLK: "Milk & Steaming",
    FIL: "Filter Coffee",
    EQP: "Equipment",
    WRK: "Café Workflow",
    SEN: "Sensory Evaluation",
    GRN: "Green Coffee",
    PRC: "Processing",
    ORG: "Origins",
    RST: "Roasting",
    BUS: "Business",
    MTH: "Brew Methods",
    CUL: "Cultivars & Varieties",
    MLS: "Milk Science",
    BRW: "Brewing Science",
    SCI: "Taste & Flavor Science",
    HIS: "History",
    CLT: "Coffee & Culture",
    PKG: "Packaging & Freshness",
    ETH: "Sustainability & Ethics",
    REC: "Recipe Cards"
};

const search = document.getElementById("search");
const searchForm = document.getElementById("searchForm");
const categoryList = document.getElementById("categoryList");
const resultCount = document.getElementById("resultCount");
const results = document.getElementById("results");
const themeToggle = document.getElementById("themeToggle");

function getParams() {
    return new URL(window.location.href).searchParams;
}

function currentCategory() {
    return getParams().get("category") || "ALL";
}

function currentQuery() {
    return getParams().get("q") || "";
}

function buildUrl(category, query) {
    const url = new URL(window.location.href);
    url.searchParams.delete("category");
    url.searchParams.delete("q");
    if (category && category !== "ALL") url.searchParams.set("category", category);
    if (query) url.searchParams.set("q", query);
    return url.pathname + url.search;
}

function renderCategoryList() {

    const active = currentCategory();
    const query = currentQuery();
    const total = allCards().length;

    categoryList.innerHTML = "";

    const allLink = document.createElement("a");
    allLink.className = "category-pill" + (active === "ALL" ? " active" : "");
    allLink.href = buildUrl("ALL", query);
    allLink.innerHTML = `All Categories <span class="category-count">${total}</span>`;
    categoryList.appendChild(allLink);

    getCategories()
        .filter(cat => cat !== "ALL")
        .forEach(cat => {

            const count = allCards().filter(card => card.category === cat).length;

            const link = document.createElement("a");
            link.className = "category-pill" + (active === cat ? " active" : "");
            link.href = buildUrl(cat, query);
            link.innerHTML = `${CATEGORY_NAMES[cat] || cat} <span class="category-count">${count}</span>`;
            categoryList.appendChild(link);

        });

}

function renderResults() {

    const category = currentCategory();
    const query = currentQuery();

    const matches = searchCards(query, category);

    resultCount.textContent = matches.length === 1
        ? "1 card"
        : `${matches.length} cards`;

    results.innerHTML = "";

    matches.forEach(card => {

        const el = document.createElement("a");
        el.className = "result-card";
        el.href = `index.html?card=${card.number}`;

        el.innerHTML = `
            <img class="result-thumb" src="images/cards/${card.hero_image || "placeholder.jpg"}" alt="" loading="lazy">
            <div class="result-body">
                <div class="result-meta">
                    <span class="result-category">${CATEGORY_NAMES[card.category] || card.category}</span>
                    <span class="result-number">#${card.number}</span>
                </div>
                <div class="result-title">${card.title}</div>
                <div class="result-definition">${card.definition}</div>
            </div>
        `;

        results.appendChild(el);

    });

    if (!matches.length) {
        results.innerHTML = `<div class="no-results">No cards match your search.</div>`;
    }

}

function setupTheme() {

    updateThemeIcon();

    themeToggle.onclick = () => {

        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", next);
        save("theme", next);
        updateThemeIcon();

    };

}

function updateThemeIcon() {

    const current = document.documentElement.getAttribute("data-theme");

    themeToggle.querySelector(".theme-toggle-icon").textContent = current === "dark" ? "☾" : "☀";
    themeToggle.setAttribute("aria-label", current === "dark" ? "Switch to light mode" : "Switch to dark mode");

}

async function init() {

    await reverifyIfStale();
    await loadCards();

    search.value = currentQuery();

    setupTheme();
    renderCategoryList();
    renderResults();

    // Live filter as the user types, updating the URL so the current
    // search/category state stays bookmarkable and shareable — no
    // full page reload needed for typing itself, only for navigating
    // between categories (real <a> links above).
    search.oninput = () => {
        const newUrl = buildUrl(currentCategory(), search.value);
        window.history.replaceState({}, "", newUrl);
        renderResults();
    };

    searchForm.onsubmit = e => {
        e.preventDefault();
    };

}

init();
