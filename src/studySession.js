import { updateReview } from "./review.js";
import { setupSwipe } from "./swipe.js";
import { lockScroll, unlockScroll } from "./scrollLock.js";
import { t, onLocaleChange } from "./i18n.js";

function escapeHtml(str) {

    const div = document.createElement("div");

    div.textContent = str;

    return div.innerHTML;

}

onLocaleChange(() => {

    if (document.getElementById("study-mode")) {

        render();

    }

});

let cards = [];
let index = 0;
let revealed = false;
let shuffle = false;
let onCloseCallback = null;
let typedAnswers = {};

export function startStudySession(studyCards, options = {}) {

    cards = [...studyCards];

    index = 0;

    revealed = false;

    shuffle = options.shuffle ?? false;

    onCloseCallback = options.onClose ?? null;

    typedAnswers = {};

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
aria-label="${t("close")}"
>

&times;

</button>

<div class="study-top">

<h2>${t("studyModeTitle")}</h2>

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

${t("shuffleSession")}

</label>

<h3>

${card.title}

</h3>

<div class="study-category cat-${card.category.toLowerCase()}">

${card.category}

</div>

<div class="study-content">

${revealed ? `

${typedAnswers[card.number]?.trim() ? `
<div class="study-section study-your-answer">

<h4>${t("studyYourAnswerSection")}</h4>

<p>${escapeHtml(typedAnswers[card.number])}</p>

</div>
` : ""}

<div class="study-section">

<h4>${t("sectionDefinition")}</h4>

<p>${card.definition}</p>

</div>

<div class="study-section">

<h4>${t("studyWhySection")}</h4>

<p>${card.why}</p>

</div>

<div class="study-section">

<h4>${t("studyTipSection")}</h4>

<p>${card.tip}</p>

</div>

<div class="study-section">

<h4>${t("studyMistakeSection")}</h4>

<p>${card.mistake}</p>

</div>

<div class="study-section">

<h4>${t("studyChallengeSection")}</h4>

<p class="challenge-hint">${t("challengeHint")}</p>

<p>${card.challenge}</p>

</div>

<div class="review-buttons">

<button data-rating="again">

<span class="dot dot-red"></span>
${t("ratingAgain")}

</button>

<button data-rating="hard">

<span class="dot dot-orange"></span>
${t("ratingHard")}

</button>

<button data-rating="good">

<span class="dot dot-green"></span>
${t("ratingGood")}

</button>

<button data-rating="easy">

<span class="dot dot-blue"></span>
${t("ratingEasy")}

</button>

</div>

` : `

<div class="study-hidden">

${t("thinkFirst")}

<br><br>

${t("pressReveal")}

<textarea
id="study-answer-input"
class="study-answer-input"
placeholder="${t("typeYourAnswerPlaceholder")}"
>${escapeHtml(typedAnswers[card.number] ?? "")}</textarea>

</div>

`}

</div>

<div class="study-actions">

<button id="study-prev" aria-label="${t("previousCard")}">

←

</button>

<button id="study-reveal">

${revealed ? t("hide") : t("reveal")}

</button>

<button id="study-next" aria-label="${t("nextCard")}">

→

</button>

</div>

<button id="study-exit">

${t("exitStudyMode")}

</button>

</div>

`;

    document.body.appendChild(overlay);

    document.getElementById("studyShuffle").onchange = e => {

        shuffle = e.target.checked;

    };
        document.getElementById("study-prev").onclick = previous;

    document.getElementById("study-next").onclick = next;

    document.getElementById("study-answer-input")?.addEventListener("input", e => {

        typedAnswers[card.number] = e.target.value;

    });

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

    if (e.target?.id === "study-answer-input") {

        if (e.key === "Escape") {

            e.target.blur();

        }

        return;

    }

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

${t("sessionComplete")}

</h2>

<p>

${t("youStudiedPrefix")}

<strong>${cards.length}</strong>

${t("youStudiedSuffix", cards.length)}

</p>

<div class="study-progress">

<div
class="study-progress-fill"
style="transform:scaleX(1)">

</div>

</div>

<div class="study-actions">

<button id="restartStudy">

${t("studyAgain")}

</button>

<button id="closeStudy">

${t("returnHome")}

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

    const overlay = document.getElementById("study-mode");

    if (!overlay) return;

    document.onkeydown = null;

    unlockScroll();

    overlay.remove();

    const callback = onCloseCallback;

    onCloseCallback = null;

    callback?.();

}
