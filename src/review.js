const KEY = "coffeeDeckReviews";

const DAY = 86400000;

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

        reviews: 0,

        interval: 0,

        ease: 2.5,

        lastReviewed: null

    };

}

export function updateReview(cardNumber, rating) {

    const data = load();

    const card = getReviewData(cardNumber);

    card.lastReviewed = Date.now();

    card.reviews++;

    switch (rating) {

        case "again":

            card.state = "learning";

            card.interval = 1;

            card.ease = Math.max(

                1.3,

                card.ease - 0.2

            );

            break;

        case "hard":

            card.state = "learning";

            card.interval = Math.max(

                3,

                Math.round(
                    (card.interval || 1) * 1.2
                )
            );

            card.ease = Math.max(

                1.3,

                card.ease - 0.15

            );

            break;

        case "good":

            card.state = "review";

            card.interval = Math.max(

                7,

                Math.round(
                    (card.interval || 1) * card.ease
                )
            );

            break;

        case "easy":

            card.state = "mastered";

            card.ease += 0.15;

            card.interval = Math.max(

                14,

                Math.round(
                    (card.interval || 3) *
                    (card.ease + 0.3)
                )
            );

            break;

    }

    card.due =

        Date.now() +

        (card.interval * DAY);

    data[cardNumber] = card;

    save(data);

}

export function resetReview(cardNumber) {

    const data = load();

    delete data[cardNumber];

    save(data);

}

export function resetAllReviews() {

    localStorage.removeItem(KEY);

}

export function getDueCards(cards) {

    const now = Date.now();

    return cards.filter(card => {

        const review = getReviewData(card.number);

        return review.due <= now;

    });

}

export function getReviewStats(cards) {

    const stats = {

        new: 0,

        learning: 0,

        review: 0,

        mastered: 0,

        dueToday: 0,

        totalReviews: 0

    };

    const now = Date.now();

    cards.forEach(card => {

        const review = getReviewData(card.number);

        stats[review.state]++;

        stats.totalReviews += review.reviews;

        if (review.due <= now) {

            stats.dueToday++;

        }

    });

    return stats;

}

export function getReviewHistory(cards) {

    return cards

        .map(card => ({

            card,

            review: getReviewData(card.number)

        }))

        .sort(

            (a, b) =>

                (b.review.lastReviewed || 0) -

                (a.review.lastReviewed || 0)

        );

}