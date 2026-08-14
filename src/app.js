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
    getRecentSearches
} from "./storage.js";

import {
    createStudySession,
    createBookmarkSession
} from "./study.js";

import {
    startStudySession
} from "./studySession.js";

import {
    getDueCards,
    getReviewStats
} from "./review.js";

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

async function init() {

    await loadCards();

    buildFilters();

    createStudyButton();

    createSortSelector();

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

}

function createStudyButton() {

    if (document.getElementById("studyButton")) return;

    const button = document.createElement("button");

    button.id = "studyButton";

    button.className = "study-button";

    button.textContent = "📚 Study Mode";

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

        .join("");

    box.querySelectorAll(".recent-search-item").forEach(
        (button, i) => {

            button.onclick = () => {

                search.value = recentTerms[i];

                hideRecentSearches();

                render();

            };

        }

    );

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

}

function buildFilters() {

    filters.innerHTML = "";

    getCategories().forEach(category => {

        const button = document.createElement("button");

        button.className = "filter";

        if (category === activeCategory) {

            button.classList.add("active");

        }

        button.textContent = category;

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

<div class="category">
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
