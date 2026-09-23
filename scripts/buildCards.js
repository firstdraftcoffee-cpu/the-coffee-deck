import fs from "fs";
import path from "path";

// Source of truth: content/<CATEGORY>.json. This script compiles it into:
//   public/data/deck/free-<lang>.json  -> PUBLIC: only the free sample cards,
//                                          plus the total count and per-category
//                                          counts (so the paywall can say "unlock
//                                          all N cards"). One small file per language.
//   worker/deck.js                     -> PRIVATE: the full deck, one localized
//                                          array per language, bundled into the
//                                          Cloudflare Worker and only handed out
//                                          by /api/deck to verified subscribers.
// Never put paid card content anywhere under public/ — everything there is
// downloadable by anyone.

const LOCALES = ["en", "es", "pt", "de", "fr", "it"];

const TRANSLATABLE_FIELDS = [
    "title",
    "definition",
    "why",
    "tip",
    "mistake",
    "challenge",
    "recipe"
];

// Most "related" links a card shows. The card's own hand-picked links always
// come first; links added automatically (from other cards pointing at this
// one) fill any remaining space.
const MAX_RELATED = 6;

const contentDir = path.resolve("content");
const publicDeckDir = path.resolve("public/data/deck");
const workerDeckFile = path.resolve("worker/deck.js");

const files = fs
    .readdirSync(contentDir)
    .filter(file => file.endsWith(".json"))
    .sort();

let cards = [];

for (const file of files) {
    cards.push(...JSON.parse(fs.readFileSync(path.join(contentDir, file), "utf8")));
}

cards.sort((a, b) => a.number.localeCompare(b.number));

// --- Integrity checks -------------------------------------------------------

let problems = 0;
const byNumber = new Map();

for (const card of cards) {
    if (byNumber.has(card.number)) {
        console.warn(`Duplicate card number "${card.number}": "${byNumber.get(card.number).title}" and "${card.title}" collide.`);
        problems++;
    }
    byNumber.set(card.number, card);
}

for (const locale of LOCALES) {
    const seenTitles = new Map();
    for (const card of cards) {
        const title = (locale === "en" ? card.title : card.translations?.[locale]?.title || card.title).trim().toLowerCase();
        if (seenTitles.has(title)) {
            console.warn(`Duplicate ${locale.toUpperCase()} title "${title}" on cards ${seenTitles.get(title)} and ${card.number}.`);
            problems++;
        }
        seenTitles.set(title, card.number);
    }
}

for (const card of cards) {
    for (const id of card.related || []) {
        if (!byNumber.has(id)) {
            console.warn(`Card ${card.number} links to missing card "${id}".`);
            problems++;
        }
    }
}

if (problems) {
    console.error(`Card build stopped: ${problems} problem(s) above.`);
    process.exit(1);
}

// --- Two-way related links ----------------------------------------------------
// If A links to B, B should link back to A. Cards that nothing else links to
// get priority when space is short, so every card ends up reachable.

const related = new Map(cards.map(card => [card.number, [...(card.related || [])]]));
const inbound = new Map(cards.map(card => [card.number, 0]));

for (const list of related.values()) {
    for (const id of list) inbound.set(id, inbound.get(id) + 1);
}

const reverse = new Map(cards.map(card => [card.number, []]));

for (const [from, list] of related) {
    for (const to of list) {
        if (!related.get(to).includes(from)) reverse.get(to).push(from);
    }
}

for (const card of cards) {
    const list = related.get(card.number);
    const candidates = reverse.get(card.number)
        .sort((a, b) => inbound.get(a) - inbound.get(b) || a.localeCompare(b));
    for (const from of candidates) {
        if (list.length >= MAX_RELATED) break;
        list.push(from);
        inbound.set(from, inbound.get(from) + 1);
    }
}

const unreachable = cards.filter(card => inbound.get(card.number) === 0).map(card => card.number);

if (unreachable.length) {
    console.warn(`Note: ${unreachable.length} card(s) still have no incoming related links: ${unreachable.join(", ")}`);
}

// --- Localize and write -------------------------------------------------------

function localize(card, locale) {
    const { translations, ...base } = card;
    const out = { ...base, id: Number(card.number), related: related.get(card.number) };
    const overrides = translations?.[locale];
    if (overrides) {
        for (const field of TRANSLATABLE_FIELDS) {
            if (overrides[field]) out[field] = overrides[field];
        }
    }
    return out;
}

const categoryCounts = {};
for (const card of cards) {
    categoryCounts[card.category] = (categoryCounts[card.category] || 0) + 1;
}

fs.rmSync(publicDeckDir, { recursive: true, force: true });
fs.mkdirSync(publicDeckDir, { recursive: true });

// The old all-languages, all-cards public file must never come back.
fs.rmSync(path.resolve("public/data/cards.json"), { force: true });

const fullDeck = {};

for (const locale of LOCALES) {
    const localized = cards.map(card => localize(card, locale));
    fullDeck[locale] = localized;
    fs.writeFileSync(
        path.join(publicDeckDir, `free-${locale}.json`),
        JSON.stringify({
            total: cards.length,
            categoryCounts,
            cards: localized.filter(card => card.free_sample)
        }),
        "utf8"
    );
}

fs.writeFileSync(
    workerDeckFile,
    "// GENERATED by scripts/buildCards.js from content/*.json — do not edit by hand.\n" +
    "// Full paid deck, served only to verified subscribers via /api/deck.\n" +
    `export default ${JSON.stringify(fullDeck)};\n`,
    "utf8"
);

const freeCount = cards.filter(card => card.free_sample).length;
console.log(`Built ${cards.length} cards (${freeCount} free) in ${LOCALES.length} languages.`);
