import {
    loadCards,
    searchCards,
    getCategories,
    allCards,
    totalCardCount,
    refreshAccess
} from "./cards.js";

import {
    hasAccess,
    startCheckout,
    restoreAccess,
    handleCheckoutReturn,
    reverifyIfStale
} from "./access.js";

import {
    openViewer,
    closeViewer
} from "./viewer.js";

import {
    getBookmarks,
    getRecent,
    addRecentSearch,
    getRecentSearches,
    clearRecentSearches,
    toggleBookmark,
    save
} from "./storage.js";

import {
    createStudySession
} from "./study.js";

import {
    startStudySession,
    closeStudySession
} from "./studySession.js";

import {
    setupSwipe
} from "./swipe.js";

import {
    openStats,
    closeStats
} from "./stats.js";

import {
    openWelcome
} from "./welcome.js";

import {
    t,
    LOCALES,
    getLocale,
    setLocale,
    onLocaleChange
} from "./i18n.js";

let activeCategory = "ALL";
let currentSort = "number";
let homeCards = [];
let homeIndex = 0;

const search = document.getElementById("search");
const home = document.getElementById("home");
const filters = document.getElementById("filters");
const counter = document.getElementById("count");
const filterToggle = document.getElementById("filterToggle");
const filterPanel = document.getElementById("filterPanel");
const studyToggle = document.getElementById("studyToggle");
const statsToggle = document.getElementById("statsToggle");
const subscribeToggle = document.getElementById("subscribeToggle");
const langSwitch = document.getElementById("langSwitch");
const homeButton = document.getElementById("homeButton");
const themeToggle = document.getElementById("themeToggle");

async function init() {

    await handleCheckoutReturn();

    await reverifyIfStale();

    await loadCards();

    applyStaticStrings();

    renderLangSwitch();

    setupTheme();

    buildFilters();

    setupNav();

    createRecentSearches();

    document.addEventListener("coffeedeck:refresh", renderHome);

    onLocaleChange(() => {

        applyStaticStrings();

        renderLangSwitch();

        buildFilters();

        renderHome();

    });

    renderHome();

    openWelcome();

}

function setupTheme() {

    updateThemeIcon();

    themeToggle.onclick = () => {

        const current = document.documentElement.getAttribute("data-theme");

        const next = current === "dark" ? "light" : "dark";

        document.documentElement.setAttribute("data-theme", next);

        save("theme", next);

        updateThemeIcon();

    };

}

function updateThemeIcon() {

    const current = document.documentElement.getAttribute("data-theme");

    themeToggle.querySelector(".theme-toggle-icon").textContent = current === "dark" ? "☾" : "☀";

    themeToggle.setAttribute("aria-label", current === "dark" ? "Switch to light mode" : "Switch to dark mode");

}

function applyStaticStrings() {

    search.placeholder = t("searchPlaceholder");

    filterToggle.setAttribute("aria-label", t("navSearchLabel"));
    filterToggle.querySelector(".icon-label").textContent = t("navSearch");

    studyToggle.setAttribute("aria-label", t("navStudyLabel"));
    studyToggle.querySelector(".icon-label").textContent = t("navStudy");

    statsToggle.setAttribute("aria-label", t("navProgressLabel"));
    statsToggle.querySelector(".icon-label").textContent = t("navProgress");

    subscribeToggle.setAttribute("aria-label", t("navSubscribeLabel"));
    subscribeToggle.textContent = t("navSubscribe");

}

function renderLangSwitch() {

    langSwitch.innerHTML = "";

    langSwitch.setAttribute("aria-label", t("languageLabel"));

    const current = getLocale();

    LOCALES.forEach(locale => {

        const button = document.createElement("button");

        button.type = "button";
        button.textContent = locale.label;
        button.title = locale.name;

        if (locale.code === current) {

            button.classList.add("active");

        }

        button.onclick = () => {

            setLocale(locale.code);

        };

        langSwitch.appendChild(button);

    });

}

function setupNav() {

    homeButton.onclick = () => {

        closeViewer();

        closeStudySession();

        closeStats();

        filterPanel.classList.remove("show");

        search.value = "";

        activeCategory = "ALL";

        buildFilters();

        homeIndex = 0;

        renderHome();

        openWelcome();

    };

    filterToggle.onclick = () => {

        filterPanel.classList.toggle("show");

        if (filterPanel.classList.contains("show")) {

            search.focus();

        }

    };

    statsToggle.onclick = () => {

        openStats();

    };

    studyToggle.onclick = () => {

        const cards = getVisibleCards();

        if (!cards.length) return;

        const session = createStudySession(cards, {
            shuffle: false
        });

        startStudySession(session, {
            onClose: renderHome
        });

    };

    subscribeToggle.onclick = () => {

        closeViewer();
        closeStudySession();
        closeStats();
        filterPanel.classList.remove("show");

        renderHome();

        homeIndex = homeCards.findIndex(card => card.isPaywallCard);

        if (homeIndex === -1) {
            homeIndex = 0;
        }

        renderHomeCard();

    };

    document.addEventListener("click", e => {

        if (
            filterPanel.classList.contains("show") &&
            !filterPanel.contains(e.target) &&
            e.target !== filterToggle
        ) {

            filterPanel.classList.remove("show");

        }

    });

}

function createRecentSearches() {

    if (document.getElementById("recentSearches")) return;

    const box = document.createElement("div");

    box.id = "recentSearches";

    box.className = "recent-searches";

    search.parentNode.insertBefore(
        box,
        search.nextSibling
    );

    search.addEventListener("focus", showRecentSearches);

    search.addEventListener("blur", () => {

        setTimeout(hideRecentSearches, 150);

    });

}

function showRecentSearches() {

    const box = document.getElementById("recentSearches");

    if (!box) return;

    if (search.value.trim()) {

        box.classList.remove("show");

        return;

    }

    const recentTerms = getRecentSearches();

    if (!recentTerms.length) {

        box.classList.remove("show");

        return;

    }

    box.innerHTML = recentTerms

        .map(term =>
            `<button class="recent-search-item">${term}</button>`
        )

        .join("") +

        `<button class="recent-search-clear">${t("clear")}</button>`;

    box.querySelectorAll(".recent-search-item").forEach(
        (button, i) => {

            button.onclick = () => {

                search.value = recentTerms[i];

                hideRecentSearches();

                homeIndex = 0;

                renderHome();

            };

        }

    );

    box.querySelector(".recent-search-clear").onclick = () => {

        clearRecentSearches();

        hideRecentSearches();

    };

    box.classList.add("show");

}

function hideRecentSearches() {

    document.getElementById("recentSearches")
        ?.classList.remove("show");

}

function escapeRegex(str) {

    return str.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

}

function highlightMatch(text, query) {

    if (!query) return text;

    const pattern = new RegExp(
        `(${escapeRegex(query)})`,
        "gi"
    );

    return text.replace(pattern, "<mark>$1</mark>");

}

function buildFilters() {

    filters.innerHTML = "";

    const total = allCards().length;

    getCategories().forEach(category => {

        const button = document.createElement("button");

        button.className = "filter";

        if (category === activeCategory) {

            button.classList.add("active");

        }

        const count = category === "ALL"
            ? total
            : allCards().filter(
                card => card.category === category
            ).length;

        button.innerHTML = `

${category}

<span class="filter-count">${count}</span>

`;

        button.onclick = () => {

            activeCategory = category;

            buildFilters();

            homeIndex = 0;

            renderHome();

            filterPanel.classList.remove("show");

        };

        filters.appendChild(button);

    });

}

function getVisibleCards() {

    const cards = searchCards(
        search.value,
        activeCategory
    );

    switch (currentSort) {

        case "title":

            return [...cards].sort((a, b) =>
                a.title.localeCompare(b.title)
            );

        case "category":

            return [...cards].sort((a, b) => {

                const compare = a.category.localeCompare(
                    b.category
                );

                if (compare !== 0) {

                    return compare;

                }

                return a.number - b.number;

            });

        default:

            if (search.value.trim()) {

                return cards;

            }

            return [...cards].sort((a, b) =>
                a.number - b.number
            );

    }

}

export function renderHome() {

    homeCards = getVisibleCards();

    counter.textContent = t("cardCount", homeCards.length);

    subscribeToggle.hidden = hasAccess();

    if (!hasAccess()) {

        homeCards = [...homeCards, { isPaywallCard: true }];

    }

    if (homeIndex >= homeCards.length) {

        homeIndex = 0;

    }

    renderHomeCard();

}

function renderHomeCard() {

    home.innerHTML = "";

    if (!homeCards.length) {

        home.innerHTML = `

<div class="home-empty">

${t("noResults")}

</div>

`;

        return;

    }

    const card = homeCards[homeIndex];

    if (card.isPaywallCard) {

        renderPaywallCard();

        return;

    }

    const query = search.value.trim();

    const heroImage = card.hero_image
        ? `/images/cards/${card.hero_image}`
        : null;

    const bookmarked = getBookmarks().includes(card.number);

    const stage = document.createElement("div");

    stage.className = "home-stage";

    if (homeCards.length > 1) {

        const peek = document.createElement("div");

        peek.className = "home-card-peek";

        stage.appendChild(peek);

    }

    const el = document.createElement("div");

    el.className = "home-card";

    el.dataset.index = homeIndex;
    el.dataset.total = homeCards.length;

    el.innerHTML = `

<div class="home-card-image">

${heroImage ? `<img src="${heroImage}" alt="${card.title}" loading="eager" decoding="async" fetchpriority="high" onerror="this.style.display='none'">` : ""}

<div class="home-card-scrim"></div>

<div class="home-card-image-top">

<span class="home-card-number">${card.number}</span>

<span class="home-card-cat">${card.category}</span>

</div>

<div class="home-card-title-overlay">

<h2>${highlightMatch(card.title, query)}</h2>

</div>

</div>

<div class="home-card-body">

<p>${highlightMatch(card.definition, query)}</p>

<div class="home-actions">

<button id="homePrev" class="arrow-btn" aria-label="${t("previousCard")}">←</button>

<button id="homeBookmark" class="bookmark-btn ${bookmarked ? "active" : ""}" aria-label="${bookmarked ? t("removeBookmark") : t("bookmark")}">${bookmarked ? "♥" : "♡"} ${t("bookmark")}</button>

<button id="homeNext" class="arrow-btn" aria-label="${t("nextCard")}">→</button>

</div>

</div>

`;

    let dragged = false;

    el.onclick = () => {

        if (dragged) {

            dragged = false;

            return;

        }

        openViewer(homeCards, homeIndex, {
            onClose: renderHomeCard
        });

    };

    stage.appendChild(el);

    home.appendChild(stage);

    el.querySelector("#homePrev").onclick = e => {

        e.stopPropagation();

        previousHome();

    };

    el.querySelector("#homeNext").onclick = e => {

        e.stopPropagation();

        nextHome();

    };

    el.querySelector("#homeBookmark").onclick = e => {

        e.stopPropagation();

        toggleBookmark(card.number);

        renderHomeCard();

    };

    setupSwipe(
        el,
        previousHome,
        nextHome,
        () => { dragged = true; }
    );

    prefetchAdjacentImages();

}

function prefetchAdjacentImages() {

    if (homeCards.length < 2) return;

    const nextCard = homeCards[(homeIndex + 1) % homeCards.length];
    const prevCard = homeCards[(homeIndex - 1 + homeCards.length) % homeCards.length];

    [nextCard, prevCard].forEach(card => {

        if (!card?.hero_image) return;

        const preloadImg = document.createElement("img");

        preloadImg.src = `/images/cards/${card.hero_image}`;

    });

}

function previousHome() {

    homeIndex = (homeIndex - 1 + homeCards.length) % homeCards.length;

    renderHomeCard();

}

function nextHome() {

    homeIndex = (homeIndex + 1) % homeCards.length;

    renderHomeCard();

}

function renderPaywallCard() {

    const stage = document.createElement("div");

    stage.className = "home-stage";

    const remaining = totalCardCount() - (homeCards.length - 1);

    const el = document.createElement("div");

    el.className = "home-card paywall-card";

    el.innerHTML = `

<div class="paywall-body">

<div class="paywall-eyebrow">${t("paywallEyebrow")}</div>

<h2>${t("paywallTitle")}</h2>

<p class="paywall-tagline">${t("paywallTagline", remaining)}</p>

<div class="paywall-plans">

<button id="paywall-monthly" class="paywall-plan">
<span class="paywall-plan-price">$4.99</span>
<span class="paywall-plan-period">${t("perMonth")}</span>
</button>

<button id="paywall-yearly" class="paywall-plan featured">
<span class="paywall-plan-badge">${t("bestValue")}</span>
<span class="paywall-plan-price">$39</span>
<span class="paywall-plan-period">${t("perYear")}</span>
</button>

</div>

<p class="paywall-status" id="paywall-status"></p>

<button id="paywall-restore-toggle" class="paywall-restore-link">${t("alreadySubscribed")}</button>

<div id="paywall-restore-form" class="paywall-restore-form" hidden>
<input type="email" id="paywall-email" placeholder="${t("emailPlaceholder")}" autocomplete="email">
<button id="paywall-verify">${t("verify")}</button>
</div>

</div>

`;

    stage.appendChild(el);

    home.appendChild(stage);

    const actions = document.createElement("div");

    actions.className = "home-actions";

    actions.innerHTML = `

<button id="homePrev" class="arrow-btn" aria-label="${t("previousCard")}">←</button>

<button id="homeNext" class="arrow-btn" aria-label="${t("nextCard")}">→</button>

`;

    home.appendChild(actions);

    actions.querySelector("#homePrev").onclick = previousHome;

    actions.querySelector("#homeNext").onclick = nextHome;

    const status = el.querySelector("#paywall-status");

    const setStatus = (msg, isError = false) => {

        status.textContent = msg || "";

        status.classList.toggle("paywall-status-error", isError);

    };

    el.querySelector("#paywall-monthly").onclick = async () => {

        setStatus(t("checkingOut"));

        try {

            await startCheckout("monthly", getLocale());

        } catch {

            setStatus(t("checkoutFailed"), true);

        }

    };

    el.querySelector("#paywall-yearly").onclick = async () => {

        setStatus(t("checkingOut"));

        try {

            await startCheckout("yearly", getLocale());

        } catch {

            setStatus(t("checkoutFailed"), true);

        }

    };

    el.querySelector("#paywall-restore-toggle").onclick = () => {

        el.querySelector("#paywall-restore-form").hidden = false;

        el.querySelector("#paywall-email").focus();

    };

    el.querySelector("#paywall-verify").onclick = async () => {

        const email = el.querySelector("#paywall-email").value.trim();

        if (!email) return;

        setStatus(t("verifying"));

        try {

            const active = await restoreAccess(email);

            if (active) {

                refreshAccess();

                homeIndex = 0;

                renderHome();

            } else {

                setStatus(t("restoreFailed"), true);

            }

        } catch {

            setStatus(t("checkoutFailed"), true);

        }

    };

}

search.oninput = () => {

    hideRecentSearches();

    homeIndex = 0;

    renderHome();

};

search.addEventListener("keydown", e => {

    if (e.key === "Enter") {

        addRecentSearch(search.value);

        search.blur();

        filterPanel.classList.remove("show");

    }

});

search.addEventListener("blur", () => {

    if (search.value.trim()) {

        addRecentSearch(search.value);

    }

});

init();
