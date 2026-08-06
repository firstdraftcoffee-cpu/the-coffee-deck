const PREFIX = "coffeeDeck";

export function save(key, value) {
    localStorage.setItem(
        `${PREFIX}:${key}`,
        JSON.stringify(value)
    );
}

export function load(key, fallback) {

    try {

        const value = localStorage.getItem(`${PREFIX}:${key}`);

        return value
            ? JSON.parse(value)
            : fallback;

    } catch {

        return fallback;

    }

}

export function toggleBookmark(cardNumber) {

    let bookmarks = load("bookmarks", []);

    if (bookmarks.includes(cardNumber)) {

        bookmarks = bookmarks.filter(
            n => n !== cardNumber
        );

    } else {

        bookmarks.push(cardNumber);

    }

    save("bookmarks", bookmarks);

    return bookmarks;

}

export function getBookmarks() {

    return load("bookmarks", []);

}

export function addRecent(cardNumber) {

    let recent = load("recent", []);

    recent = recent.filter(
        n => n !== cardNumber
    );

    recent.unshift(cardNumber);

    recent = recent.slice(0,20);

    save("recent", recent);

    return recent;

}

export function getRecent() {

    return load("recent", []);

}