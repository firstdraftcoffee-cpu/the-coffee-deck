let session = [];

export function createStudySession(cards, options = {}) {

    session = [...cards];

    if (options.shuffle) {

        shuffle(session);

    }

    return session;

}

export function getStudySession() {

    return session;

}

export function createCategorySession(allCards, category, shuffleCards = false) {

    let filtered = allCards.filter(

        card => card.category === category

    );

    if (shuffleCards) {

        shuffle(filtered);

    }

    session = filtered;

    return session;

}

export function createBookmarkSession(allCards, bookmarks) {

    session = allCards.filter(

        card => bookmarks.includes(card.number)

    );

    return session;

}

export function createRecentSession(allCards, recent) {

    session = allCards.filter(

        card => recent.includes(card.number)

    );

    return session;

}

function shuffle(array) {

    for (

        let i = array.length - 1;

        i > 0;

        i--

    ) {

        const j = Math.floor(

            Math.random() * (i + 1)

        );

        [

            array[i],

            array[j]

        ] = [

            array[j],

            array[i]

        ];

    }

}