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

let activeCategory = "ALL";

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

    updateDashboard();

    render();

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

        if(category === activeCategory){

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

function render() {

    const cards = searchCards(

        search.value,

        activeCategory

    );

    counter.textContent = `${cards.length} Cards`;

    cardsContainer.innerHTML = "";

    cards.forEach((card,index)=>{

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

        div.onclick = ()=>{

            openViewer(cards,index);

            updateDashboard();

        };

        cardsContainer.appendChild(div);

    });

}

search.oninput = render;

init();