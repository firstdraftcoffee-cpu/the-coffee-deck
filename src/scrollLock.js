let savedScrollY = 0;
let lockCount = 0;

export function lockScroll() {

    lockCount++;

    if (lockCount > 1) return;

    savedScrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    const home = document.getElementById("home");

    if (home) {

        home.style.visibility = "hidden";
        home.setAttribute("inert", "");

    }

}

export function unlockScroll() {

    lockCount = Math.max(0, lockCount - 1);

    if (lockCount > 0) return;

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";

    window.scrollTo(0, savedScrollY);

    const home = document.getElementById("home");

    if (home) {

        home.style.visibility = "";
        home.removeAttribute("inert");

    }

}
