import fs from "fs";
import path from "path";

const contentDir = path.resolve("content");
const outputFile = path.resolve("data/cards.json");

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

cards = cards.map((card, index) => ({

    ...card,

    id: index + 1,

    number: String(index + 1).padStart(3, "0")

}));

fs.writeFileSync(

    outputFile,

    JSON.stringify(cards, null, 2),

    "utf8"

);

console.log(`✅ Built ${cards.length} cards.`);