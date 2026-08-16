import {
    lockScroll,
    unlockScroll
} from "./scrollLock.js";

import { t, onLocaleChange } from "./i18n.js";

onLocaleChange(() => {

    const overlay = document.getElementById("welcome-mode");

    if (overlay && overlay.classList.contains("show")) {

        openWelcome();

    }

});

let onCloseCallback = null;

export function openWelcome(options = {}) {

    if ("onClose" in options) {

        onCloseCallback = options.onClose;

    }

    let overlay = document.getElementById("welcome-mode");

    const alreadyOpen = !!overlay;

    if (!overlay) {

        overlay = document.createElement("div");

        overlay.id = "welcome-mode";

        document.body.appendChild(overlay);

    }

    overlay.innerHTML = `

<div class="welcome-window">

<div class="welcome-hero">
<img src="/images/cards/021.jpg" alt="">
</div>

<button class="close close-lg" id="welcome-close" aria-label="${t("close")}">&times;</button>

<div class="welcome-body">

<div class="welcome-eyebrow">${t("welcomeEyebrow")}</div>

<h2>${t("welcomeTitle")}</h2>

<p class="welcome-tagline">${t("welcomeTagline")}</p>

<div class="welcome-features">

<div class="welcome-feature">
<span class="welcome-feature-num">1</span>
<div>
<strong>${t("welcomeFeature1Title")}</strong>
<p>${t("welcomeFeature1Desc")}</p>
</div>
</div>

<div class="welcome-feature">
<span class="welcome-feature-num">2</span>
<div>
<strong>${t("welcomeFeature2Title")}</strong>
<p>${t("welcomeFeature2Desc")}</p>
</div>
</div>

<div class="welcome-feature">
<span class="welcome-feature-num">3</span>
<div>
<strong>${t("welcomeFeature3Title")}</strong>
<p>${t("welcomeFeature3Desc")}</p>
</div>
</div>

<div class="welcome-feature">
<span class="welcome-feature-num">4</span>
<div>
<strong>${t("welcomeFeature4Title")}</strong>
<p>${t("welcomeFeature4Desc")}</p>
</div>
</div>

</div>

<button id="welcome-cta" class="welcome-cta">${t("welcomeCta")}</button>

</div>

</div>

`;

    overlay.classList.add("show");

    if (!alreadyOpen) {

        lockScroll();

    }

    const close = () => closeWelcome();

    overlay.querySelector("#welcome-close").addEventListener("click", close);

    overlay.querySelector("#welcome-cta").addEventListener("click", close);

    overlay.onclick = e => {

        if (e.target === overlay) {

            close();

        }

    };

    document.onkeydown = e => {

        if (!overlay.classList.contains("show")) return;

        if (e.key === "Escape") {

            close();

        }

    };

}

export function closeWelcome() {

    const overlay = document.getElementById("welcome-mode");

    if (!overlay) return;

    document.onkeydown = null;

    unlockScroll();

    overlay.classList.remove("show");

    setTimeout(() => {

        if (overlay.parentNode) {

            overlay.remove();

        }

        const callback = onCloseCallback;

        onCloseCallback = null;

        callback?.();

    }, 150);

}
