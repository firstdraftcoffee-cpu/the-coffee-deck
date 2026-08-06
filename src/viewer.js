import {
    toggleBookmark,
    getBookmarks,
    addRecent
} from "./storage.js";

let currentCards = [];
let currentIndex = 0;

export function openViewer(cards, index) {

    currentCards = cards;
    currentIndex = index;

    const card = cards[index];

    addRecent(card.number);

    let viewer = document.getElementById("viewer");

    if (!viewer) {

        viewer = document.createElement("div");

        viewer.id = "viewer";

        document.body.appendChild(viewer);

    }

    const bookmarked = getBookmarks().includes(card.number);

    viewer.innerHTML = `

<div class="viewer-window">

<button class="close">×</button>

<div class="viewer-number">
${card.number}
</div>

<h1>
${card.title}
</h1>

<div class="viewer-category">
${card.category}
</div>

<p>
${card.definition}
</p>

<div class="viewer-buttons">

<button id="bookmark">

${bookmarked ? "★ Bookmarked" : "☆ Bookmark"}

</button>

<button id="previous">

← Previous

</button>

<button id="next">

Next →

</button>

</div>

</div>

`;

    viewer.classList.add("show");

    viewer.querySelector(".close").onclick = closeViewer;

    viewer.onclick = e => {

        if (e.target.id === "viewer") {

            closeViewer();

        }

    };

    document.getElementById("bookmark").onclick = () => {

        toggleBookmark(card.number);

        openViewer(currentCards, currentIndex);

    };

    document.getElementById("previous").onclick = previous;

    document.getElementById("next").onclick = next;

}

function previous() {

    currentIndex--;

    if (currentIndex < 0) {

        currentIndex = currentCards.length - 1;

    }

    openViewer(currentCards, currentIndex);

}

function next() {

    currentIndex++;

    if (currentIndex >= currentCards.length) {

        currentIndex = 0;

    }

    openViewer(currentCards, currentIndex);

}

export function closeViewer() {

    document
        .getElementById("viewer")
        ?.classList
        .remove("show");

}