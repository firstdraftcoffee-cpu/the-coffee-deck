const KEY = "coffeeDeckReviews";

function load() {

    return JSON.parse(

        localStorage.getItem(KEY) || "{}"

    );

}

function save(data) {

    localStorage.setItem(

        KEY,

        JSON.stringify(data)

    );

}

export function getReviewData(cardNumber) {

    const data = load();

    return data[cardNumber] || {

        state: "new",

        due: Date.now(),

        reviews: 0

    };

}

export function updateReview(cardNumber, rating) {

    const data = load();

    const card = getReviewData(cardNumber);

    const day = 86400000;

    switch (rating) {

        case "again":

            card.state = "learning";

            card.due = Date.now() + day;

            break;

        case "hard":

            card.state = "learning";

            card.due = Date.now() + day * 3;

            break;

        case "good":

            card.state = "review";

            card.due = Date.now() + day * 7;

            break;

        case "easy":

            card.state = "mastered";

            card.due = Date.now() + day * 30;

            break;

    }

    card.reviews++;

    data[cardNumber] = card;

    save(data);

}

export function getDueCards(cards) {

    const now = Date.now();

    return cards.filter(card => {

        const review = getReviewData(card.number);

        return review.due <= now;

    });

}

export function getReviewStats(cards) {

    let stats = {

        new:0,

        learning:0,

        review:0,

        mastered:0

    };

    cards.forEach(card=>{

        const state = getReviewData(card.number).state;

        stats[state]++;

    });

    return stats;

}