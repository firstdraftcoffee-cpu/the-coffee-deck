export function setupSwipe(element, onPrev, onNext, onDragStart) {

    let startX = 0;
    let dx = 0;
    let dragging = false;

    element.addEventListener("pointerdown", e => {

        if (e.target.closest("button, a, input, label, .related-card")) return;

        dragging = true;

        startX = e.clientX;

        element.style.transition = "none";

        try {

            element.setPointerCapture(e.pointerId);

        } catch {}

    });

    element.addEventListener("pointermove", e => {

        if (!dragging) return;

        dx = e.clientX - startX;

        if (Math.abs(dx) > 6) {

            onDragStart?.();

        }

        element.style.transform =
            `translateX(${dx}px) rotate(${dx / 25}deg)`;

    });

    const release = () => {

        if (!dragging) return;

        dragging = false;

        element.style.transition =
            "transform .25s ease, opacity .25s ease";

        if (Math.abs(dx) > 120) {

            const dir = dx > 0 ? 1 : -1;

            element.style.transform =
                `translateX(${dir * 500}px) rotate(${dir * 25}deg)`;

            element.style.opacity = "0";

            setTimeout(() => {

                if (dir > 0) {

                    onPrev();

                } else {

                    onNext();

                }

            }, 180);

        } else {

            element.style.transform = "";

        }

        dx = 0;

    };

    element.addEventListener("pointerup", release);

    element.addEventListener("pointercancel", release);

}
