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

function formatTimer(seconds) {

    if (!seconds) return null;

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;

    return `${m}:${String(s).padStart(2, "0")}`;

}

function buildRecipeSection(recipe) {

    if (!recipe) return "";

    return `

<section class="viewer-section recipe-stats-section">

<div class="recipe-stats">

<div class="recipe-stat"><span>${t("recipeRatio")}</span><strong>${recipe.ratio}</strong></div>
<div class="recipe-stat"><span>${t("recipeGrind")}</span><strong>${recipe.grind}</strong></div>
<div class="recipe-stat"><span>${t("recipeWaterTemp")}</span><strong>${recipe.water_temp}</strong></div>
<div class="recipe-stat"><span>${t("recipeTotalTime")}</span><strong>${recipe.total_time}</strong></div>

</div>

</section>

<section class="viewer-section recipe-calc-section">

<h3>${t("sectionRecipeCalc")}</h3>

<div class="recipe-calc" data-ratio-value="${recipe.ratio_value}" data-output-label="${recipe.output_label}">

<label class="recipe-calc-row">
<span>${t("recipeCalcDoseLabel")}: <strong class="calc-dose-value">${recipe.dose_g}</strong>g</span>
<input type="range" class="calc-dose-slider" min="${Math.max(1, Math.round(recipe.dose_g * 0.5))}" max="${Math.round(recipe.dose_g * 2)}" step="1" value="${recipe.dose_g}">
</label>

<label class="recipe-calc-row">
<span>${t("recipeCalcRatioLabel")}: <strong class="calc-ratio-value">1:${recipe.ratio_value}</strong></span>
<input type="range" class="calc-ratio-slider" min="${Math.max(1, (recipe.ratio_value * 0.6).toFixed(1))}" max="${(recipe.ratio_value * 1.4).toFixed(1)}" step="0.5" value="${recipe.ratio_value}">
<div class="recipe-calc-scale"><span>${t("recipeCalcStronger")}</span><span>${t("recipeCalcWeaker")}</span></div>
</label>

<p class="recipe-calc-result">
${recipe.output_label === "yield"
    ? t("recipeCalcResultYield").replace("{amount}", (recipe.dose_g * recipe.ratio_value).toFixed(0))
    : t("recipeCalcResultWater").replace("{amount}", (recipe.dose_g * recipe.ratio_value).toFixed(0))
}
</p>

</div>

</section>

<section class="viewer-section">

<h3>${t("sectionDialIn")}</h3>

<dl class="recipe-dial-in">

${(recipe.dial_in || []).map(d => `
<dt>${d.issue}</dt>
<dd>${d.fix}</dd>
`).join("")}

</dl>

</section>

<section class="viewer-section">

<h3>${t("sectionRecipeSteps")}</h3>

<ol class="recipe-steps">

${(recipe.steps || []).map(step => `
<li>
<div class="recipe-step-head">
<strong>${step.title}</strong>
${formatTimer(step.timer_seconds) ? `<span class="recipe-step-timer">${formatTimer(step.timer_seconds)}</span>` : ""}
</div>
<p>${step.content}</p>
</li>
`).join("")}

</ol>

</section>

`;

}

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
loading="eager"
decoding="async"
fetchpriority="high"
onerror="this.parentElement.style.display='none'"
>

</div>

${card.photo_unverified ? `

<p class="viewer-photo-note">${t("photoUnverified")}</p>

` : ""}

${card.photo_placeholder ? `

<p class="viewer-photo-note">${t("photoPlaceholder")}</p>

` : ""}

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

${buildRecipeSection(card.recipe)}

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

<p class="challenge-hint">${t("challengeHint")}</p>

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

        if (e.target?.type === "range") {

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

    const calc = viewer.querySelector(".recipe-calc");

    if (calc) {

        const outputLabel = calc.dataset.outputLabel;

        const doseSlider = calc.querySelector(".calc-dose-slider");
        const ratioSlider = calc.querySelector(".calc-ratio-slider");
        const doseDisplay = calc.querySelector(".calc-dose-value");
        const ratioDisplay = calc.querySelector(".calc-ratio-value");
        const resultEl = calc.querySelector(".recipe-calc-result");

        const updateResult = () => {

            const dose = parseFloat(doseSlider.value);
            const ratio = parseFloat(ratioSlider.value);
            const amount = Math.round(dose * ratio);

            doseDisplay.textContent = dose;
            ratioDisplay.textContent = `1:${ratio}`;

            resultEl.textContent = outputLabel === "yield"
                ? t("recipeCalcResultYield").replace("{amount}", amount)
                : t("recipeCalcResultWater").replace("{amount}", amount);

        };

        doseSlider.addEventListener("input", updateResult);
        ratioSlider.addEventListener("input", updateResult);

    }

    setupSwipe(
        viewer.querySelector(".viewer-window"),
        previous,
        next
    );

    prefetchAdjacentImages();

}

function prefetchAdjacentImages() {

    if (currentCards.length < 2) return;

    const nextCard = currentCards[(currentIndex + 1) % currentCards.length];
    const prevCard = currentCards[(currentIndex - 1 + currentCards.length) % currentCards.length];

    [nextCard, prevCard].forEach(card => {

        if (!card?.hero_image) return;

        const preloadImg = document.createElement("img");

        preloadImg.src = `/images/cards/${card.hero_image}`;

    });

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