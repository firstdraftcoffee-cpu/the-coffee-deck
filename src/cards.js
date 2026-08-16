import { getLocale, onLocaleChange } from "./i18n.js";

const TRANSLATABLE_FIELDS = [
    "title",
    "definition",
    "why",
    "tip",
    "mistake",
    "challenge"
];

let rawCards = [];
let cards = [];

function localize(card, locale) {

    const overrides = card.translations?.[locale];

    if (!overrides) return card;

    const localized = { ...card };

    TRANSLATABLE_FIELDS.forEach(field => {

        if (overrides[field]) {

            localized[field] = overrides[field];

        }

    });

    return localized;

}

function applyLocale() {

    const locale = getLocale();

    cards = rawCards.map(card => localize(card, locale));

}

onLocaleChange(applyLocale);

export async function loadCards() {

    const response = await fetch("./data/cards.json");

    rawCards = await response.json();

    applyLocale();

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