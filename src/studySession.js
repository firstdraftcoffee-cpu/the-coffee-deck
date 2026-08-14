import { updateReview } from "./review.js";

let cards = [];
let index = 0;
let revealed = false;
let shuffle = false;
let onCloseCallback = null;

export function startStudySession(studyCards, options = {}) {

    cards = [...studyCards];

    index = 0;

    revealed = false;

    shuffle = options.shuffle ?? false;

    onCloseCallback = options.onClose ?? null;

    render();

}

function render() {

    if (!cards.length) {

        finishSession();

        return;

    }

    document.getElementById("study-mode")?.remove();

    const progress = Math.round(

        ((index + 1) / cards.length) * 100

    );

    const card = cards[index];

    const overlay = document.createElement("div");

    overlay.id = "study-mode";

    overlay.innerHTML = `

<div class="study-window">

<div class="study-top">

<div>

<h2>Study Mode</h2>

<div class="study-counter">

Card ${index + 1} of ${cards.length}

</div>

</div>

<div class="study-progress">

<div
class="study-progress-fill"
style="width:${progress}%">

</div>

</div>

</div>

<label class="study-toggle">

<input
id="studyShuffle"
type="checkbox"
${shuffle ? "checked" : ""}>

Shuffle Session

</label>

<h1>

${card.title}

</h1>

<div class="study-category">

${card.category}

</div>

<div class="study-content">

${revealed ? `

<div class="study-section">

<h3>Definition</h3>

<p>${card.definition}</p>

</div>

<div class="study-section">

<h3>Why it Matters</h3>

<p>${card.why}</p>

</div>

<div class="study-section">

<h3>Pro Tip</h3>

<p>${card.tip}</p>

</div>

<div class="study-section">

<h3>Common Mistake</h3>

<p>${card.mistake}</p>

</div>

<div class="study-section">

<h3>Challenge</h3>

<p>${card.challenge}</p>

</div>

<div class="review-buttons">

<button data-rating="again">

🔴 Again

</button>

<button data-rating="hard">

🟠 Hard

</button>

<button data-rating="good">

🟢 Good

</button>

<button data-rating="easy">

🔵 Easy

</button>

</div>

` : `

<div class="study-hidden">

Think of the answer first.

<br><br>

Press Reveal when ready.

</div>

`}

</div>

<div class="study-actions">

<button id="study-prev">

← Previous

</button>

<button id="study-reveal">

${revealed ? "Hide" : "Reveal"}

</button>

<button id="study-next">

Next →

</button>

</div>

<button id="study-exit">

Exit Study Mode

</button>

</div>

`;

    document.body.appendChild(overlay);

    document.getElementById("studyShuffle").onchange = e => {

        shuffle = e.target.checked;

    };
        document.getElementById("study-prev").onclick = previous;

    document.getElementById("study-next").onclick = next;

    document.getElementById("study-reveal").onclick = () => {

        revealed = !revealed;

        render();

    };

    document.getElementById("study-exit").onclick = closeStudySession;

    document.querySelectorAll(".review-buttons button").forEach(button => {

        button.onclick = () => {

            const rating = button.dataset.rating;

            updateReview(card.number, rating);

            next();

        };

    });

    document.onkeydown = keyboardHandler;

}

function previous() {

    if (index > 0) {

        index--;

    }

    revealed = false;

    render();

}

function next() {

    if (shuffle) {

        let nextIndex = index;

        while (cards.length > 1 && nextIndex === index) {

            nextIndex = Math.floor(

                Math.random() * cards.length

            );

        }

        index = nextIndex;

    } else {

        index++;

    }

    if (index >= cards.length) {

        finishSession();

        return;

    }

    revealed = false;

    render();

}

function keyboardHandler(e) {

    switch (e.key) {

        case "ArrowLeft":

            previous();

            break;

        case "ArrowRight":

            next();

            break;

        case " ":

            e.preventDefault();

            revealed = !revealed;

            render();

            break;

        case "Escape":

            closeStudySession();

            break;

    }

}

function finishSession() {

    document.getElementById("study-mode")?.remove();

    const overlay = document.createElement("div");

    overlay.id = "study-mode";

    overlay.innerHTML = `
    <div class="study-window">

<h1>

🎉 Session Complete

</h1>

<p>

You studied

<strong>${cards.length}</strong>

cards.

</p>

<div class="study-progress">

<div
class="study-progress-fill"
style="width:100%">

</div>

</div>

<div class="study-actions">

<button id="restartStudy">

Study Again

</button>

<button id="closeStudy">

Return Home

</button>

</div>

</div>

`;

    document.body.appendChild(overlay);

    document.getElementById("restartStudy").onclick = () => {

        index = 0;

        revealed = false;

        render();

    };

    document.getElementById("closeStudy").onclick = closeStudySession;

}

export function closeStudySession() {

    document.onkeydown = null;

    document.getElementById("study-mode")?.remove();

    const callback = onCloseCallback;

    onCloseCallback = null;

    callback?.();

}