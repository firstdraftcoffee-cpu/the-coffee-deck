const KEY = "coffeeDeckReviews";

const ACTIVITY_KEY = "coffeeDeckActivity";

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

function loadActivity() {

    return JSON.parse(

        localStorage.getItem(ACTIVITY_KEY) || "[]"

    );

}

function saveActivity(entries) {

    localStorage.setItem(

        ACTIVITY_KEY,

        JSON.stringify(entries)

    );

}

function logActivity(cardNumber, rating, state) {

    const entries = loadActivity();

    entries.push({
        date: new Date().toISOString().slice(0, 10),
        timestamp: Date.now(),
        cardNumber,
        rating,
        state
    });

    saveActivity(entries.slice(-2000));

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

    logActivity(cardNumber, rating, card.state);

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

        return review.reviews > 0 && review.due <= now;

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

        if (review.reviews > 0 && review.due <= now) {

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

export function getDailyActivity(days = 84) {

    const entries = loadActivity();

    const counts = {};

    entries.forEach(entry => {

        counts[entry.date] = (counts[entry.date] || 0) + 1;

    });

    const result = [];

    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {

        const d = new Date(today);

        d.setDate(d.getDate() - i);

        const key = d.toISOString().slice(0, 10);

        result.push({
            date: key,
            count: counts[key] || 0
        });

    }

    return result;

}

export function getStreak() {

    const daily = getDailyActivity(365);

    let streak = 0;

    for (let i = daily.length - 1; i >= 0; i--) {

        if (daily[i].count > 0) {

            streak++;

        } else if (i === daily.length - 1) {

            continue;

        } else {

            break;

        }

    }

    return streak;

}

export function getCategoryStats(cards) {

    const byCategory = {};

    cards.forEach(card => {

        const review = getReviewData(card.number);

        if (!byCategory[card.category]) {

            byCategory[card.category] = {
                category: card.category,
                totalReviews: 0,
                cardsReviewed: 0,
                totalEase: 0
            };

        }

        const bucket = byCategory[card.category];

        bucket.totalReviews += review.reviews;

        if (review.reviews > 0) {

            bucket.cardsReviewed++;

            bucket.totalEase += review.ease;

        }

    });

    return Object.values(byCategory).map(bucket => ({

        category: bucket.category,
        totalReviews: bucket.totalReviews,
        cardsReviewed: bucket.cardsReviewed,

        avgEase: bucket.cardsReviewed > 0
            ? +(bucket.totalEase / bucket.cardsReviewed).toFixed(2)
            : null

    }));

}