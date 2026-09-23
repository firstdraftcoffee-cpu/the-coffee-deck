import { getLocale, onLocaleChange } from "./i18n.js";
import { hasAccess, getAccessPass } from "./access.js";

// Card data arrives already translated, one language at a time:
//   /data/deck/free-<lang>.json  public free sample + deck totals
//   /api/deck?lang=<lang>        full deck, only for verified subscribers
// Decks are kept per language, so switching back to a language already
// used this session is instant.

const decks = {};

let total = 0;
let cards = [];

async function fetchDeck(locale) {

    const free = await (await fetch(`./data/deck/free-${locale}.json`)).json();

    total = free.total;

    let list = free.cards;

    const pass = getAccessPass();

    if (hasAccess() && pass) {

        try {

            const res = await fetch(`/api/deck?lang=${locale}`, {

                headers: { Authorization: `Bearer ${pass}` }

            });

            if (res.ok) {

                list = await res.json();

            }

        } catch {

            // Offline with nothing cached: fall back to the free sample.

        }

    }

    decks[locale] = list;

    return list;

}

function rebuild() {

    const list = decks[getLocale()];

    if (list) {

        cards = list;

    }

}

onLocaleChange(rebuild);

// Load a language's cards before switching to it, so everything that
// re-renders on the locale change already has the right cards.
export async function prepareLocale(locale) {

    if (!decks[locale]) {

        await fetchDeck(locale);

    }

}

// Call after access changes (subscribe, restore): drops cached decks and
// reloads the current language with the new access level.
export async function refreshAccess() {

    Object.keys(decks).forEach(key => delete decks[key]);

    await fetchDeck(getLocale());

    rebuild();

}

export function totalCardCount() {

    return total;

}

export async function loadCards() {

    await fetchDeck(getLocale());

    rebuild();

    return cards;

}

export function allCards() {

    return cards;

}

export function getCategories() {

    return [

        "ALL",

        ...new Set(

            cards.map(card => card.category)

        )

    ];

}

function levenshtein(a, b) {

    if (Math.abs(a.length - b.length) > 2) return 3;

    const rows = a.length + 1;
    const cols = b.length + 1;

    const dp = Array.from(
        { length: rows },
        () => new Array(cols).fill(0)
    );

    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;

    for (let i = 1; i < rows; i++) {

        for (let j = 1; j < cols; j++) {

            if (a[i - 1] === b[j - 1]) {

                dp[i][j] = dp[i - 1][j - 1];

            } else {

                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1]
                );

            }

        }

    }

    return dp[rows - 1][cols - 1];

}

function scoreCard(card, query) {

    const title = card.title.toLowerCase();
    const definition = card.definition.toLowerCase();

    if (title === query) return 100;

    if (title.startsWith(query)) return 80;

    if (title.includes(query)) return 60;

    if (definition.includes(query)) return 30;

    if (query.length >= 3) {

        const words = title.split(/\s+/);

        for (const word of words) {

            if (
                Math.abs(word.length - query.length) <= 2 &&
                levenshtein(word, query) <= 1
            ) {

                return 15;

            }

        }

    }

    return -1;

}

export function searchCards(text = "", category = "ALL") {

    const query = text.toLowerCase().trim();

    return cards

        .filter(card =>
            category === "ALL" || card.category === category
        )

        .map(card => ({
            card,
            score: query ? scoreCard(card, query) : 0
        }))

        .filter(({ score }) => score >= 0)

        .sort((a, b) => b.score - a.score)

        .map(({ card }) => card);

}

export function getCard(number) {

    return cards.find(

        card => card.number === number

    );

}