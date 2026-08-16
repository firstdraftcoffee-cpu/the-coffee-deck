import {
    toggleBookmark,
    getBookmarks,
    addRecent
} from "./storage.js";

import {
    renderReviewButtons
} from "./reviewButtons.js";

import {
    setupSwipe
} from "./swipe.js";

import {
    lockScroll,
    unlockScroll
} from "./scrollLock.js";

import { t, onLocaleChange } from "./i18n.js";

onLocaleChange(() => {

    const viewer = document.getElementById("viewer");

    if (viewer && viewer.classList.contains("show")) {

        openViewer(currentCards, currentIndex);

    }

});

let currentCards = [];
let currentIndex = 0;
let onCloseCallback = null;

export function openViewer(cards, index, options = {}) {

    currentCards = cards;
    currentIndex = index;

    if ("onClose" in options) {

        onCloseCallback = options.onClose;

    }

    const card = currentCards[currentIndex];

    const heroImage = card.hero_image
        ? `/images/cards/${card.hero_image}`
        : null;

    addRecent(card.number);

    let viewer = document.getElementById("viewer");

    if (!viewer) {

        viewer = document.createElement("div");

        viewer.id = "viewer";

        document.body.appendChild(viewer);

        lockScroll();

    }

    const bookmarked =
        getBookmarks().includes(card.number);

    const relatedCards =
        (card.related || [])
            .map(id =>
                currentCards.find(
                    c => c.number === id
                )
            )
            .filter(Boolean);

    viewer.innerHTML = `

<div class="viewer-window">

<button
class="close close-lg"
aria-label="${t("close")}"
>

&times;

</button>

<div class="viewer-header">

<div class="viewer-number">

#${card.number}

</div>

<div class="viewer-category cat-${card.category.toLowerCase()}">

${card.category}

</div>

</div>

<h2>

${card.title}

</h2>

${heroImage ? `

<div class="viewer-image">

<img
src="${heroImage}"
alt="${card.title}"
onerror="this.parentElement.style.display='none'"
>

</div>

` : ""}

<section class="viewer-section">

<h3>${t("sectionDefinition")}</h3>

<p>

${card.definition}

</p>

</section>

<section class="viewer-section">

<h3>${t("sectionWhy")}</h3>

<p>

${card.why}

</p>

</section>

<section class="viewer-section">

<h3>${t("sectionTip")}</h3>

<p>

${card.tip}

</p>

</section>

<section class="viewer-section">

<h3>${t("sectionMistake")}</h3>

<p>

${card.mistake}

</p>

</section>

<section class="viewer-section">

<h3>${t("sectionChallenge")}</h3>

<p>

${card.challenge}

</p>

</section>

<div id="viewer-review"></div>

${relatedCards.length
    ? `

<section class="viewer-related">

<h3>${t("sectionRelated")}</h3>

<div class="related-grid">

${relatedCards.map(c => `

<button
class="related-card"
data-number="${c.number}"
>

<div>

${c.number}

</div>

<strong>

${c.title}

</strong>

</button>

`).join("")}

</div>

</section>

`
    : ""
}

<div class="viewer-buttons">

<button id="previous" aria-label="${t("previousCard")}">

←

</button>

<button id="bookmark" class="bookmark-btn ${bookmarked ? "active" : ""}" aria-label="${bookmarked ? t("removeBookmark") : t("bookmark")}">

${bookmarked ? "♥" : "♡"}

</button>

<button id="next" aria-label="${t("nextCard")}">

→

</button>

</div>

</div>

`;

    viewer.classList.add("show");

    const reviewContainer =
        viewer.querySelector(
            "#viewer-review"
        );

    if (reviewContainer) {

        reviewContainer.appendChild(

            renderReviewButtons(
                card.number,
                () => {

                    openViewer(
                        currentCards,
                        currentIndex
                    );

                },
                { showRatings: false }
            )

        );

    }

    viewer
        .querySelector(".close")
        .addEventListener(
            "click",
            closeViewer
        );

    viewer.onclick = e => {

        if (e.target === viewer) {

            closeViewer();

        }

    };

    document.onkeydown = e => {

        if (
            !viewer.classList.contains(
                "show"
            )
        ) {

            return;

        }

        switch (e.key) {

            case "Escape":

                closeViewer();

                break;

            case "ArrowLeft":

                previous();

                break;

            case "ArrowRight":

                next();

                break;

        }

    };

    const bookmarkButton =
        viewer.querySelector(
            "#bookmark"
        );

    bookmarkButton.addEventListener(
        "click",
        () => {

            toggleBookmark(
                card.number
            );

            const nowBookmarked =
                getBookmarks()
                    .includes(
                        card.number
                    );

            bookmarkButton.textContent =
                nowBookmarked
                    ? "♥"
                    : "♡";

            bookmarkButton.classList.toggle(
                "active",
                nowBookmarked
            );

        }
    );

    viewer
        .querySelector("#previous")
        .addEventListener(
            "click",
            previous
        );

    viewer
        .querySelector("#next")
        .addEventListener(
            "click",
            next
        );

    viewer
        .querySelectorAll(
            ".related-card"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const number =
                        button.dataset.number;

                    const relatedIndex =
                        currentCards.findIndex(
                            c =>
                                c.number ===
                                number
                        );

                    if (
                        relatedIndex !== -1
                    ) {

                        openViewer(
                            currentCards,
                            relatedIndex
                        );

                    }

                }
            );

        });

    setupSwipe(
        viewer.querySelector(".viewer-window"),
        previous,
        next
    );

}

function previous() {

    currentIndex--;

    if (currentIndex < 0) {

        currentIndex =
            currentCards.length - 1;

    }

    openViewer(
        currentCards,
        currentIndex
    );

}

function next() {

    currentIndex++;

    if (
        currentIndex >=
        currentCards.length
    ) {

        currentIndex = 0;

    }

    openViewer(
        currentCards,
        currentIndex
    );

}

export function closeViewer() {

    const viewer =
        document.getElementById(
            "viewer"
        );

    if (!viewer) {

        return;

    }

    document.onkeydown = null;

    unlockScroll();

    viewer.classList.remove(
        "show"
    );

    setTimeout(() => {

        if (viewer.parentNode) {

            viewer.remove();

        }

        const callback = onCloseCallback;

        onCloseCallback = null;

        callback?.();

    }, 150);

}