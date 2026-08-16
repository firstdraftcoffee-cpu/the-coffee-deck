import {
    updateReview,
    getReviewData,
    resetReview
} from "./review.js";

import { t } from "./i18n.js";

export function renderReviewButtons(
    cardNumber,
    onComplete,
    options = {}
) {

    const showRatings = options.showRatings ?? true;

    const wrapper = document.createElement("div");

    wrapper.className = "review-wrapper";

    const review = getReviewData(cardNumber);

    const status = document.createElement("div");

    status.className = "review-status";

    status.innerHTML = `

<span class="dot ${stateDotClass(review.state)}"></span>

<strong>${formatState(review.state)}</strong>

<span class="review-count">
${t("reviewsLabel", review.reviews)}
</span>

${review.reviews > 0 ? `

<button class="reset-progress">
${t("resetProgress")}
</button>

` : ""}

`;

    wrapper.appendChild(status);

    const resetButton = status.querySelector(".reset-progress");

    if (resetButton) {

        resetButton.onclick = () => {

            resetReview(cardNumber);

            onComplete();

        };

    }

    if (!showRatings) {

        const hint = document.createElement("p");

        hint.className = "review-hint";

        hint.textContent = t("rateInStudyMode");

        wrapper.appendChild(hint);

        return wrapper;

    }

    const container = document.createElement("div");

    container.className = "review-buttons";

    const ratings = [

        {
            id: "again",
            dot: "dot-red",
            label: t("ratingAgain"),
            hint: t("ratingAgainHint")
        },

        {
            id: "hard",
            dot: "dot-orange",
            label: t("ratingHard"),
            hint: t("ratingHardHint")
        },

        {
            id: "good",
            dot: "dot-green",
            label: t("ratingGood"),
            hint: t("ratingGoodHint")
        },

        {
            id: "easy",
            dot: "dot-blue",
            label: t("ratingEasy"),
            hint: t("ratingEasyHint")
        }

    ];

    ratings.forEach(item => {

        const button = document.createElement("button");

        button.className = "review-button";

        button.innerHTML = `

<span class="dot ${item.dot}"></span>

<div>${item.label}</div>

<small>${item.hint}</small>

`;

        button.onclick = () => {

            updateReview(
                cardNumber,
                item.id
            );

            button.disabled = true;

            onComplete();

        };

        container.appendChild(button);

    });

    wrapper.appendChild(container);

    return wrapper;

}

function stateDotClass(state) {

    switch (state) {

        case "learning": return "dot-orange";
        case "review": return "dot-green";
        case "mastered": return "dot-gold";
        default: return "dot-gray";

    }

}

function formatState(state) {

    switch (state) {

        case "learning": return t("stateLearning");
        case "review": return t("stateReview");
        case "mastered": return t("stateMastered");
        default: return t("stateNew");

    }

}
