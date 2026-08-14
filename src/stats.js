import { allCards } from "./cards.js";

import {
    getReviewStats,
    getDailyActivity,
    getStreak,
    getCategoryStats,
    getReviewHistory
} from "./review.js";

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

    document.getElementById("stats-close").onclick = closeStats;

    overlay.onclick = e => {

        if (e.target === overlay) {

            closeStats();

        }

    };

    document.addEventListener("keydown", statsKeyHandler);

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
