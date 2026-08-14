import {
    loadCards,
    searchCards,
    getCategories,
    allCards
} from "./cards.js";

import {
    openViewer
} from "./viewer.js";

import {
    getBookmarks,
    getRecent,
    addRecentSearch,
    getRecentSearches,
    clearRecentSearches
} from "./storage.js";

import {
    createStudySession,
    createBookmarkSession,
    createRecentSession
} from "./study.js";

import {
    startStudySession
} from "./studySession.js";

import {
    getDueCards,
    getReviewStats
} from "./review.js";

import {
    openStats
} from "./stats.js";

let activeCategory = "ALL";
let currentSort = "number";

const search = document.getElementById("search");
const cardsContainer = document.getElementById("cards");
const filters = document.getElementById("filters");
const counter = document.getElementById("count");

const totalCards = document.getElementById("totalCards");
const bookmarkCount = document.getElementById("bookmarkCount");
const recentCount = document.getElementById("recentCount");
const dueCount = document.getElementById("dueCount");
const masteredCount = document.getElementById("masteredCount");

const dueStat = document.getElementById("dueStat");
const bookmarkStat = bookmarkCount.closest(".stat");
const recentStat = recentCount.closest(".stat");
const exportButton = document.getElementById("exportBookmarks");

async function init() {

    await loadCards();

    buildFilters();

    createStudyButton();

    createSortSelector();

    createStatsButton();

    createRecentSearches();

    setupDashboardActions();

    updateDashboard();

    render();

}

function setupDashboardActions() {

    dueStat.classList.add("clickable");

    dueStat.onclick = () => {

        const due = getDueCards(allCards());

        if (!due.length) return;

        const session = createStudySession(due, {
            shuffle: false
        });

        startStudySession(session, {
            onClose: updateDashboard
        });

    };

    bookmarkStat.classList.add("clickable");

    bookmarkStat.onclick = () => {

        const bookmarks = getBookmarks();

        if (!bookmarks.length) return;

        const session = createBookmarkSession(
            allCards(),
            bookmarks
        );

        startStudySession(session, {
            onClose: updateDashboard
        });

    };

    exportButton.onclick = e => {

        e.stopPropagation();

        const bookmarks = getBookmarks();

        if (!bookmarks.length) return;

        const cards = allCards().filter(
            card => bookmarks.includes(card.number)
        );

        downloadJSON(
            "coffee-deck-bookmarks.json",
            buildBookmarkExport(cards)
        );

    };

    recentStat.classList.add("clickable");

    recentStat.onclick = () => {

        const recent = getRecent();

        if (!recent.length) return;

        const session = createRecentSession(
            allCards(),
            recent
        );

        startStudySession(session, {
            onClose: updateDashboard
        });

    };

}

function createStudyButton() {

    if (document.getElementById("studyButton")) return;

    const button = document.createElement("button");

    button.id = "studyButton";

    button.className = "study-button";

    button.textContent = "Study Mode";

    button.onclick = () => {

        const cards = getVisibleCards();

        const session = createStudySession(cards, {
            shuffle: false
        });

        startStudySession(session, {
            onClose: updateDashboard
        });

    };

    filters.parentNode.insertBefore(
        button,
        filters.nextSibling
    );

}

function createSortSelector() {

    if (document.getElementById("sortSelector")) return;

    const select = document.createElement("select");

    select.id = "sortSelector";

    select.className = "sort-selector";

    [
        ["number", "Sort: Card Number"],
        ["title", "Sort: Title"],
        ["category", "Sort: Category"]
    ].forEach(([value, label]) => {

        const option = document.createElement("option");

        option.value = value;

        option.textContent = label;

        select.appendChild(option);

    });

    select.onchange = () => {

        currentSort = select.value;

        render();

    };

    filters.parentNode.insertBefore(
        select,
        document.getElementById("studyButton").nextSibling
    );

}

function createStatsButton() {

    if (document.getElementById("statsButton")) return;

    const button = document.createElement("button");

    button.id = "statsButton";

    button.className = "study-button stats-button";

    button.textContent = "Stats";

    button.onclick = () => {

        openStats();

    };

    filters.parentNode.insertBefore(
        button,
        document.getElementById("sortSelector").nextSibling
    );

}

function createRecentSearches() {

    if (document.getElementById("recentSearches")) return;

    const box = document.createElement("div");

    box.id = "recentSearches";

    box.className = "recent-searches";

    search.parentNode.insertBefore(
        box,
        search.nextSibling
    );

    search.addEventListener("focus", showRecentSearches);

    search.addEventListener("blur", () => {

        setTimeout(hideRecentSearches, 150);

    });

}

function showRecentSearches() {

    const box = document.getElementById("recentSearches");

    if (!box) return;

    if (search.value.trim()) {

        box.classList.remove("show");

        return;

    }

    const recentTerms = getRecentSearches();

    if (!recentTerms.length) {

        box.classList.remove("show");

        return;

    }

    box.innerHTML = recentTerms

        .map(term =>
            `<button class="recent-search-item">${term}</button>`
        )

        .join("") +

        `<button class="recent-search-clear">Clear</button>`;

    box.querySelectorAll(".recent-search-item").forEach(
        (button, i) => {

            button.onclick = () => {

                search.value = recentTerms[i];

                hideRecentSearches();

                render();

            };

        }

    );

    box.querySelector(".recent-search-clear").onclick = () => {

        clearRecentSearches();

        hideRecentSearches();

    };

    box.classList.add("show");

}

function hideRecentSearches() {

    document.getElementById("recentSearches")
        ?.classList.remove("show");

}

function escapeRegex(str) {

    return str.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}

function highlightMatch(text, query) {

    if (!query) return text;

    const pattern = new RegExp(
        `(${escapeRegex(query)})`,
        "gi"
    );

    return text.replace(pattern, "<mark>$1</mark>");

}

function updateDashboard() {

    totalCards.textContent = searchCards().length;

    bookmarkCount.textContent = getBookmarks().length;

    recentCount.textContent = getRecent().length;

    const stats = getReviewStats(allCards());

    dueCount.textContent = stats.dueToday;

    masteredCount.textContent = stats.mastered;

    dueStat.classList.toggle(
        "disabled",
        stats.dueToday === 0
    );

    bookmarkStat.classList.toggle(
        "disabled",
        getBookmarks().length === 0
    );

    exportButton.style.display =
        getBookmarks().length === 0 ? "none" : "inline-block";

    recentStat.classList.toggle(
        "disabled",
        getRecent().length === 0
    );

}

function buildBookmarkExport(cards) {

    const payload = cards.map(card => ({
        number: card.number,
        title: card.title,
        category: card.category,
        definition: card.definition
    }));

    return JSON.stringify(payload, null, 2);

}

function downloadJSON(filename, content) {

    const blob = new Blob(
        [content],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}

function buildFilters() {

    filters.innerHTML = "";

    const total = allCards().length;

    getCategories().forEach(category => {

        const button = document.createElement("button");

        button.className = "filter";

        if (category !== "ALL") {

            button.classList.add("cat-" + category.toLowerCase());

        }

        if (category === activeCategory) {

            button.classList.add("active");

        }

        const count = category === "ALL"
            ? total
            : allCards().filter(
                card => card.category === category
            ).length;

        button.innerHTML = `

${category}

<span class="filter-count">${count}</span>

`;

        button.onclick = () => {

            activeCategory = category;

            buildFilters();

            render();

        };

        filters.appendChild(button);

    });

}

function getVisibleCards() {

    const cards = searchCards(
        search.value,
        activeCategory
    );

    switch (currentSort) {

        case "title":

            return [...cards].sort((a, b) =>
                a.title.localeCompare(b.title)
            );

        case "category":

            return [...cards].sort((a, b) => {

                const compare = a.category.localeCompare(
                    b.category
                );

                if (compare !== 0) {

                    return compare;

                }

                return a.number - b.number;

            });

        default:

            if (search.value.trim()) {

                return cards;

            }

            return [...cards].sort((a, b) =>
                a.number - b.number
            );

    }

}

function render() {

    const cards = getVisibleCards();

    const query = search.value.trim();

    counter.textContent = `${cards.length} Cards`;

    cardsContainer.innerHTML = "";

    cards.forEach((card, index) => {

        const div = document.createElement("div");

        div.className = "card";

        div.innerHTML = `

<div class="card-number">
${card.number}
</div>

<h2>
${highlightMatch(card.title, query)}
</h2>

<div class="category cat-${card.category.toLowerCase()}">
${card.category}
</div>

<p>
${highlightMatch(card.definition, query)}
</p>

`;

        div.onclick = () => {

            openViewer(cards, index, {
                onClose: updateDashboard
            });

        };

        cardsContainer.appendChild(div);

    });

}

search.oninput = () => {

    hideRecentSearches();

    render();

};

search.addEventListener("keydown", e => {

    if (e.key === "Enter") {

        addRecentSearch(search.value);

        search.blur();

    }

});

search.addEventListener("blur", () => {

    if (search.value.trim()) {

        addRecentSearch(search.value);

    }

});

init();
