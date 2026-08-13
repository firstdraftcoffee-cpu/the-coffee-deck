import fs from "fs";
import path from "path";

const contentDir = path.resolve("content");
const outputDir = path.resolve("public/data");
const outputFile = path.join(outputDir, "cards.json");

fs.mkdirSync(outputDir, { recursive: true });

const files = fs
    .readdirSync(contentDir)
    .filter(file => file.endsWith(".json"))
    .sort();

let cards = [];

for (const file of files) {

    const filePath = path.join(contentDir, file);

    const data = JSON.parse(
        fs.readFileSync(filePath, "utf8")
    );

    cards.push(...data);

}

cards.sort((a, b) => a.number.localeCompare(b.number));

const seen = new Map();

for (const card of cards) {

    if (seen.has(card.number)) {

        console.warn(

            `⚠️  Duplicate card number "${card.number}": "${seen.get(card.number)}" and "${card.title}" collide.`

        );

    }

    seen.set(card.number, card.title);

}

cards = cards.map(card => ({

    ...card,

    id: Number(card.number)

}));

fs.writeFileSync(

    outputFile,

    JSON.stringify(cards, null, 2),

    "utf8"

);

console.log(`✅ Built ${cards.length} cards.`);