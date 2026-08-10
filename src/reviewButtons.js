import { updateReview } from "./review.js";

export function renderReviewButtons(cardNumber, onComplete) {

    const container = document.createElement("div");

    container.className = "review-buttons";

    const ratings = [

        ["again","🔴 Again"],

        ["hard","🟠 Hard"],

        ["good","🟢 Good"],

        ["easy","🔵 Easy"]

    ];

    ratings.forEach(([rating,label])=>{

        const button=document.createElement("button");

        button.textContent=label;

        button.className="review-button";

        button.onclick=()=>{

            updateReview(cardNumber,rating);

            onComplete();

        };

        container.appendChild(button);

    });

    return container;

}