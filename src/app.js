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
    clearRecentSearches,
    toggleBookmark
} from "./storage.js";

import {
    createStudySession
} from "./study.js";

import {
    startStudySession
} from "./studySession.js";

import {
    setupSwipe
} from "./swipe.js";

import {
    openStats
} from "./stats.js";

let activeCategory = "ALL";
let currentSort = "number";
let homeCards = [];
let homeIndex = 0;

const search = document.getElementById("search");
const home = document.getElementById("home");
const filters = document.getElementById("filters");
const counter = document.getElementById("count");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const studyToggle = document.getElementById("studyToggle");
const statsToggle = document.getElementById("statsToggle");

async function init() {

    await loadCards();

    buildFilters();

    setupNav();

    createRecentSearches();

    document.addEventListener("coffeedeck:refresh", renderHome);

    renderHome();

}

function setupNav() {

    filterToggle.onclick = () => {

        filterPanel.classList.toggle("show");

        if (filterPanel.classList.contains("show")) {

            search.focus();

        }

    };

    statsToggle.onclick = () => {

        openStats();

    };

    studyToggle.onclick = () => {

        const cards = getVisibleCards();

        if (!cards.length) return;

        const session = createStudySession(cards, {
            shuffle: false
        });

        startStudySession(session, {
            onClose: renderHome
        });

    };

    document.addEventListener("click", e => {

        if (
            filterPanel.classList.contains("show") &&
            !filterPanel.contains(e.target) &&
            e.target !== filterToggle
        ) {

            filterPanel.classList.remove("show");

        }

    });

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

                homeIndex = 0;

                renderHome();

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

function buildFilters() {

    filters.innerHTML = "";

    const total = allCards().length;

    getCategories().forEach(category => {

        const button = document.createElement("button");

        button.className = "filter";

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

            homeIndex = 0;

            renderHome();

            filterPanel.classList.remove("show");

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

export function renderHome() {

    homeCards = getVisibleCards();

    counter.textContent = `${homeCards.length} Cards`;

    if (homeIndex >= homeCards.length) {

        homeIndex = 0;

    }

    renderHomeCard();

}

function renderHomeCard() {

    home.innerHTML = "";

    if (!homeCards.length) {

        home.innerHTML = `

<div class="home-empty">

No cards match your search.

</div>

`;

        return;

    }

    const card = homeCards[homeIndex];

    const query = search.value.trim();

    const heroImage = card.hero_image
        ? `/images/cards/${card.hero_image}`
        : null;

    const bookmarked = getBookmarks().includes(card.number);

    const stage = document.createElement("div");

    stage.className = "home-stage";

    if (homeCards.length > 1) {

        const peek = document.createElement("div");

        peek.className = "home-card-peek";

        stage.appendChild(peek);

    }

    const el = document.createElement("div");

    el.className = "home-card";

    el.innerHTML = `

${heroImage ? `

<div class="home-card-image">
<img src="${heroImage}" alt="${card.title}" onerror="this.parentElement.style.display='none'">
</div>

` : ""}

<div class="home-card-body">

<div class="home-card-top">

<span class="card-number">${card.number}</span>

<span class="category cat-${card.category.toLowerCase()}">${card.category}</span>

</div>

<h2>${highlightMatch(card.title, query)}</h2>

<p>${highlightMatch(card.definition, query)}</p>

</div>

<div class="home-progress">${homeIndex + 1} / ${homeCards.length}</div>

`;

    let dragged = false;

    el.onclick = () => {

        if (dragged) {

            dragged = false;

            return;

        }

        openViewer(homeCards, homeIndex, {
            onClose: renderHomeCard
        });

    };

    stage.appendChild(el);

    home.appendChild(stage);

    const actions = document.createElement("div");

    actions.className = "home-actions";

    actions.innerHTML = `

<button id="homePrev" aria-label="Previous card">←</button>

<button id="homeBookmark" class="bookmark-btn ${bookmarked ? "active" : ""}" aria-label="${bookmarked ? "Remove bookmark" : "Bookmark"}">${bookmarked ? "♥" : "♡"}</button>

<button id="homeNext" aria-label="Next card">→</button>

`;

    home.appendChild(actions);

    actions.querySelector("#homePrev").onclick = previousHome;

    actions.querySelector("#homeNext").onclick = nextHome;

    actions.querySelector("#homeBookmark").onclick = e => {

        e.stopPropagation();

        toggleBookmark(card.number);

        renderHomeCard();

    };

    setupSwipe(
        el,
        previousHome,
        nextHome,
        () => { dragged = true; }
    );

}

function previousHome() {

    homeIndex = (homeIndex - 1 + homeCards.length) % homeCards.length;

    renderHomeCard();

}

function nextHome() {

    homeIndex = (homeIndex + 1) % homeCards.length;

    renderHomeCard();

}

search.oninput = () => {

    hideRecentSearches();

    homeIndex = 0;

    renderHome();

};

search.addEventListener("keydown", e => {

    if (e.key === "Enter") {

        addRecentSearch(search.value);

        search.blur();

        filterPanel.classList.remove("show");

    }

});

search.addEventListener("blur", () => {

    if (search.value.trim()) {

        addRecentSearch(search.value);

    }

});

init();
