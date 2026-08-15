export function setupSwipe(element, onPrev, onNext, onDragStart) {

    const DISTANCE_THRESHOLD = 80;
    const VELOCITY_THRESHOLD = 0.5;
    const MAX_ROTATE = 18;
    const FADE_DISTANCE = 220;

    let startX = 0;
    let startTime = 0;
    let dx = 0;
    let dragging = false;

    element.addEventListener("pointerdown", e => {

        if (e.target.closest("button, a, input, label, .related-card")) return;

        dragging = true;

        startX = e.clientX;

        startTime = Date.now();

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

        const rotate = Math.max(
            -MAX_ROTATE,
            Math.min(MAX_ROTATE, dx / 12)
        );

        const fade = Math.max(
            0.5,
            1 - Math.abs(dx) / FADE_DISTANCE
        );

        element.style.transform =
            `translateX(${dx}px) rotate(${rotate}deg)`;

        element.style.opacity = `${fade}`;

    });

    const release = () => {

        if (!dragging) return;

        dragging = false;

        const elapsed = Math.max(
            Date.now() - startTime,
            1
        );

        const velocity = Math.abs(dx) / elapsed;

        const committed =
            Math.abs(dx) > DISTANCE_THRESHOLD ||
            velocity > VELOCITY_THRESHOLD;

        element.style.transition =
            "transform .25s ease, opacity .25s ease";

        if (committed && dx !== 0) {

            const dir = dx > 0 ? 1 : -1;

            element.style.transform =
                `translateX(${dir * 600}px) rotate(${dir * MAX_ROTATE}deg)`;

            element.style.opacity = "0";

            setTimeout(() => {

                if (dir > 0) {

                    onPrev();

                } else {

                    onNext();

                }

            }, 160);

        } else {

            element.style.transform = "";

            element.style.opacity = "1";

        }

        dx = 0;

    };

    element.addEventListener("pointerup", release);

    element.addEventListener("pointercancel", release);

}
