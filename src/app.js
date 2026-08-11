import {
    loadCards,
    searchCards,
    getCategories
} from "./cards.js";

import {
    openViewer
} from "./viewer.js";

import {
    getBookmarks,
    getRecent
} from "./storage.js";

import {
    createStudySession
} from "./study.js";

import {
    startStudySession
} from "./studySession.js";

let activeCategory = "ALL";
let currentSort = "number";

const search = document.getElementById("search");
const cardsContainer = document.getElementById("cards");
const filters = document.getElementById("filters");
const counter = document.getElementById("count");

const totalCards = document.getElementById("totalCards");
const bookmarkCount = document.getElementById("bookmarkCount");
const recentCount = document.getElementById("recentCount");

async function init() {

    await loadCards();

    buildFilters();

    createStudyButton();

    createSortSelector();

    updateDashboard();

    render();

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

        startStudySession(session);

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

function updateDashboard() {

    totalCards.textContent = searchCards().length;

    bookmarkCount.textContent = getBookmarks().length;

    recentCount.textContent = getRecent().length;

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

            return [...cards].sort((a, b) =>
                a.number - b.number
            );

    }

}

function render() {

    const cards = getVisibleCards();

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
${card.title}
</h2>

<div class="category">
${card.category}
</div>

<p>
${card.definition}
</p>

`;

        div.onclick = () => {

            openViewer(cards, index);

            updateDashboard();

        };

        cardsContainer.appendChild(div);

    });

}

search.oninput = render;

init();
