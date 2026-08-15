import { allCards } from "./cards.js";

import {
    getReviewStats,
    getDailyActivity,
    getStreak,
    getCategoryStats,
    getReviewHistory,
    getDueCards
} from "./review.js";

import {
    getBookmarks,
    getRecent
} from "./storage.js";

import {
    createStudySession,
    createBookmarkSession,
    createRecentSession
} from "./study.js";

import {
    startStudySession
} from "./studySession.js";

import {
    lockScroll,
    unlockScroll
} from "./scrollLock.js";

export function openStats() {

    const cards = allCards();

    const stats = getReviewStats(cards);
    const streak = getStreak();
    const daily = getDailyActivity(84);
    const categoryStats = getCategoryStats(cards)
        .filter(c => c.totalReviews > 0);
    const history = getReviewHistory(cards)
        .filter(h => h.review.lastReviewed)
        .slice(0, 8);

    const bookmarks = getBookmarks();
    const recent = getRecent();
    const dueCards = getDueCards(cards);

    const completionPct = cards.length
        ? Math.round(
            ((stats.review + stats.mastered) / cards.length) * 100
        )
        : 0;

    const mostStudied = [...categoryStats]
        .sort((a, b) => b.totalReviews - a.totalReviews)
        .slice(0, 3);

    const withEase = categoryStats.filter(c => c.avgEase !== null);

    const strongest = [...withEase]
        .sort((a, b) => b.avgEase - a.avgEase)
        .slice(0, 3);

    const weakest = [...withEase]
        .sort((a, b) => a.avgEase - b.avgEase)
        .slice(0, 3);

    let overlay = document.getElementById("stats-mode");

    if (!overlay) {

        overlay = document.createElement("div");

        overlay.id = "stats-mode";

        document.body.appendChild(overlay);

    }

    overlay.innerHTML = `

<div class="stats-window">

<div class="stats-top">

<h2>Your progress</h2>

<button id="stats-close" aria-label="Close">&times;</button>

</div>

<h3>Library</h3>

<div class="stats-summary">

<div class="stats-tile">
<span class="stats-tile-value">${cards.length}</span>
<span class="stats-tile-label">Total Cards</span>
</div>

<div class="stats-tile clickable ${bookmarks.length ? "" : "disabled"}" id="tile-bookmarks">
<span class="stats-tile-value">${bookmarks.length}</span>
<span class="stats-tile-label">Bookmarks</span>
${bookmarks.length ? `<button id="tile-export" class="export-link">Export</button>` : ""}
</div>

<div class="stats-tile clickable ${recent.length ? "" : "disabled"}" id="tile-recent">
<span class="stats-tile-value">${recent.length}</span>
<span class="stats-tile-label">Recently Viewed</span>
</div>

<div class="stats-tile clickable ${dueCards.length ? "" : "disabled"}" id="tile-due">
<span class="stats-tile-value">${dueCards.length}</span>
<span class="stats-tile-label">Due Today</span>
</div>

</div>

<h3>Progress</h3>

<div class="stats-summary">

<div class="stats-tile">
<span class="stats-tile-value">${streak}</span>
<span class="stats-tile-label">Day Streak</span>
</div>

<div class="stats-tile">
<span class="stats-tile-value">${stats.totalReviews}</span>
<span class="stats-tile-label">Total Reviews</span>
</div>

<div class="stats-tile">
<span class="stats-tile-value">${stats.mastered}</span>
<span class="stats-tile-label">Mastered</span>
</div>

<div class="stats-tile">
<span class="stats-tile-value">${completionPct}%</span>
<span class="stats-tile-label">Completion</span>
</div>

</div>

<h3>Activity, Last 12 Weeks</h3>

<div class="heatmap-grid">

${daily.map(day => `

<div
class="heatmap-day ${heatLevel(day.count)}"
title="${day.date}: ${day.count} review${day.count === 1 ? "" : "s"}"
></div>

`).join("")}

</div>

${categoryStats.length ? `

<div class="stats-categories">

<div class="category-column">
<h4>Most Studied</h4>
${renderCategoryList(mostStudied, c => `${c.totalReviews} reviews`)}
</div>

<div class="category-column">
<h4>Strongest</h4>
${renderCategoryList(strongest, c => `${c.avgEase.toFixed(2)} ease`)}
</div>

<div class="category-column">
<h4>Needs Work</h4>
${renderCategoryList(weakest, c => `${c.avgEase.toFixed(2)} ease`)}
</div>

</div>

` : `

<p class="stats-empty">
Study a few cards to see category breakdowns here.
</p>

`}

${history.length ? `

<h3>Recent Activity</h3>

<div class="stats-recent">

${history.map(h => `

<div class="stats-recent-item">
<span class="stats-recent-title">${h.card.title}</span>
<span class="stats-recent-badge badge-${h.review.state}">${formatRating(h.review)}</span>
</div>

`).join("")}

</div>

` : ""}

</div>

`;

    overlay.classList.add("show");

    lockScroll();

    document.getElementById("stats-close").onclick = closeStats;

    overlay.onclick = e => {

        if (e.target === overlay) {

            closeStats();

        }

    };

    document.addEventListener("keydown", statsKeyHandler);

    document.getElementById("tile-due").onclick = () => {

        if (!dueCards.length) return;

        const session = createStudySession(dueCards, { shuffle: false });

        closeStats();

        startStudySession(session, { onClose: notifyRefresh });

    };

    document.getElementById("tile-bookmarks").onclick = e => {

        if (e.target.id === "tile-export") return;

        if (!bookmarks.length) return;

        const session = createBookmarkSession(cards, bookmarks);

        closeStats();

        startStudySession(session, { onClose: notifyRefresh });

    };

    document.getElementById("tile-recent").onclick = () => {

        if (!recent.length) return;

        const session = createRecentSession(cards, recent);

        closeStats();

        startStudySession(session, { onClose: notifyRefresh });

    };

    const exportBtn = document.getElementById("tile-export");

    if (exportBtn) {

        exportBtn.onclick = e => {

            e.stopPropagation();

            const bookmarkedCards = cards.filter(
                c => bookmarks.includes(c.number)
            );

            downloadJSON(
                "coffee-deck-bookmarks.json",
                buildBookmarkExport(bookmarkedCards)
            );

        };

    }

}

function notifyRefresh() {

    document.dispatchEvent(new CustomEvent("coffeedeck:refresh"));

}

function buildBookmarkExport(cards) {

    const payload = cards.map(card => ({
        number: card.number,
        title: card.title,
        category: card.category,
        definition: card.definition
    }));

    return JSON.stringify(payload, null, 2);

}

function downloadJSON(filename, content) {

    const blob = new Blob(
        [content],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}

function statsKeyHandler(e) {

    if (e.key === "Escape") {

        closeStats();

    }

}

export function closeStats() {

    const overlay = document.getElementById("stats-mode");

    if (!overlay) return;

    overlay.classList.remove("show");

    unlockScroll();

    document.removeEventListener("keydown", statsKeyHandler);

    setTimeout(() => {

        if (overlay.parentNode) {

            overlay.remove();

        }

    }, 150);

}

function heatLevel(count) {

    if (count === 0) return "level-0";
    if (count <= 2) return "level-1";
    if (count <= 5) return "level-2";
    return "level-3";

}

function renderCategoryList(items, formatValue) {

    if (!items.length) {

        return `<p class="category-empty">Not enough data yet.</p>`;

    }

    return `<ul>${items.map(c => `

<li>
<span><span class="dot cat-dot-${c.category.toLowerCase()}"></span>${c.category}</span>
<span>${formatValue(c)}</span>
</li>

`).join("")}</ul>`;

}

function formatRating(review) {

    switch (review.state) {

        case "learning": return "Learning";
        case "review": return "Reviewing";
        case "mastered": return "Mastered";
        default: return "New";

    }

}
