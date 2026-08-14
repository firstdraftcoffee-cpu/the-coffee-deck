import {
    updateReview,
    getReviewData,
    resetReview
} from "./review.js";

export function renderReviewButtons(
    cardNumber,
    onComplete
) {

    const wrapper = document.createElement("div");

    wrapper.className = "review-wrapper";

    const review = getReviewData(cardNumber);

    const status = document.createElement("div");

    status.className = "review-status";

    status.innerHTML = `

<span class="dot ${stateDotClass(review.state)}"></span>

<strong>${formatState(review.state)}</strong>

<span class="review-count">
Reviews: ${review.reviews}
</span>

${review.reviews > 0 ? `

<button class="reset-progress">
Reset progress
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

    const container = document.createElement("div");

    container.className = "review-buttons";

    const ratings = [

        {
            id: "again",
            dot: "dot-red",
            label: "Again",
            hint: "<1 min"
        },

        {
            id: "hard",
            dot: "dot-orange",
            label: "Hard",
            hint: "~3 days"
        },

        {
            id: "good",
            dot: "dot-green",
            label: "Good",
            hint: "~1 week"
        },

        {
            id: "easy",
            dot: "dot-blue",
            label: "Easy",
            hint: "2+ weeks"
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

        case "learning": return "Learning";
        case "review": return "Reviewing";
        case "mastered": return "Mastered";
        default: return "New";

    }

}
