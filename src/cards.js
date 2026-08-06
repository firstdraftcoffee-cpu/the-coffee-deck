let cards = [];

export async function loadCards() {

    const response = await fetch("./data/cards.json");

    cards = await response.json();

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

export function searchCards(text = "", category = "ALL") {

    text = text.toLowerCase();

    return cards.filter(card => {

        const categoryMatch =

            category === "ALL" ||

            card.category === category;

        const textMatch =

            card.title.toLowerCase().includes(text)

            ||

            card.definition.toLowerCase().includes(text);

        return categoryMatch && textMatch;

    });

}

export function getCard(number) {

    return cards.find(

        card => card.number === number

    );

}