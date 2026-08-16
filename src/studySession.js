import { updateReview } from "./review.js";
import { setupSwipe } from "./swipe.js";
import { lockScroll, unlockScroll } from "./scrollLock.js";

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

    lockScroll();

    render();

}

function render() {

    if (!cards.length) {

        finishSession();

        return;

    }

    document.getElementById("study-mode")?.remove();

    const progress = (index + 1) / cards.length;

    const card = cards[index];

    const overlay = document.createElement("div");

    overlay.id = "study-mode";

    overlay.innerHTML = `

<div class="study-window" data-index="${index}" data-total="${cards.length}">

<button
class="close close-lg"
id="study-exit-x"
aria-label="Close"
>

&times;

</button>

<div class="study-top">

<h2>Study Mode</h2>

<div class="study-progress">

<div
class="study-progress-fill"
style="transform:scaleX(${progress})">

</div>

</div>

</div>

<label class="study-toggle">

<input
id="studyShuffle"
type="checkbox"
${shuffle ? "checked" : ""}>

Shuffle session

</label>

<h3>

${card.title}

</h3>

<div class="study-category cat-${card.category.toLowerCase()}">

${card.category}

</div>

<div class="study-content">

${revealed ? `

<div class="study-section">

<h4>Definition</h4>

<p>${card.definition}</p>

</div>

<div class="study-section">

<h4>Why it matters</h4>

<p>${card.why}</p>

</div>

<div class="study-section">

<h4>Pro tip</h4>

<p>${card.tip}</p>

</div>

<div class="study-section">

<h4>Common mistake</h4>

<p>${card.mistake}</p>

</div>

<div class="study-section">

<h4>Challenge</h4>

<p>${card.challenge}</p>

</div>

<div class="review-buttons">

<button data-rating="again">

<span class="dot dot-red"></span>
Again

</button>

<button data-rating="hard">

<span class="dot dot-orange"></span>
Hard

</button>

<button data-rating="good">

<span class="dot dot-green"></span>
Good

</button>

<button data-rating="easy">

<span class="dot dot-blue"></span>
Easy

</button>

</div>

` : `

<div class="study-hidden">

Think of the answer first.

<br><br>

Press reveal when ready.

</div>

`}

</div>

<div class="study-actions">

<button id="study-prev" aria-label="Previous card">

←

</button>

<button id="study-reveal">

${revealed ? "Hide" : "Reveal"}

</button>

<button id="study-next" aria-label="Next card">

→

</button>

</div>

<button id="study-exit">

Exit study mode

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

    document.getElementById("study-exit-x").onclick = closeStudySession;

    document.querySelectorAll(".review-buttons button").forEach(button => {

        button.onclick = () => {

            const rating = button.dataset.rating;

            updateReview(card.number, rating);

            next();

        };

    });

    document.onkeydown = keyboardHandler;

    setupSwipe(
        overlay.querySelector(".study-window"),
        previous,
        next
    );

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

<h2>

Session complete

</h2>

<p>

You studied

<strong>${cards.length}</strong>

cards.

</p>

<div class="study-progress">

<div
class="study-progress-fill"
style="transform:scaleX(1)">

</div>

</div>

<div class="study-actions">

<button id="restartStudy">

Study again

</button>

<button id="closeStudy">

Return home

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

    unlockScroll();

    document.getElementById("study-mode")?.remove();

    const callback = onCloseCallback;

    onCloseCallback = null;

    callback?.();

}
