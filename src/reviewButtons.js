import {
    updateReview,
    getReviewData
} from "./review.js";

export function renderReviewButtons(
    cardNumber,
    onComplete
) {

    const review = getReviewData(cardNumber);

    const container = document.createElement("div");

    container.className = "review-buttons";

    const title = document.createElement("div");

    title.className = "review-status";

    title.innerHTML = `

<strong>${formatState(review.state)}</strong>

<span>
Reviews: ${review.reviews}
</span>

`;

    container.appendChild(title);

    const ratings = [

        {
            id: "again",
            label: "🔴 Again",
            hint: "<1 min"
        },

        {
            id: "hard",
            label: "🟠 Hard",
            hint: "~3 days"
        },

        {
            id: "good",
            label: "🟢 Good",
            hint: "~1 week"
        },

        {
            id: "easy",
            label: "🔵 Easy",
            hint: "2+ weeks"
        }

    ];

    ratings.forEach(item => {

        const button = document.createElement("button");

        button.className = "review-button";

        button.innerHTML = `

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

    return container;

}

function formatState(state) {

    switch (state) {

        case "learning":

            return "🟠 Learning";

        case "review":

            return "🟢 Reviewing";

        case "mastered":

            return "🏆 Mastered";

        default:

            return "⚪ New";

    }

}