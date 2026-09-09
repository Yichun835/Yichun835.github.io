(() => {
  "use strict";

  const storageKey = "yc-opening-welcome-v3-played";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const releaseFirstPaint = () => window.dispatchEvent(new Event("yc:opening-ready"));

  try {
    if (window.sessionStorage.getItem(storageKey) === "true") {
      releaseFirstPaint();
      return;
    }
  } catch {
    // The opening remains available when session storage is restricted.
  }

  if (reducedMotion.matches) {
    try {
      window.sessionStorage.setItem(storageKey, "true");
    } catch {
      // No persistent state is required for the reduced-motion fallback.
    }
    releaseFirstPaint();
    return;
  }

  const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
  const overlay = document.createElement("div");
  overlay.className = "yc-opening-screen";
  overlay.dataset.state = "ready";
  overlay.tabIndex = 0;
  overlay.setAttribute("role", "button");
  overlay.setAttribute("aria-label", chinese ? "点击进入学术主页" : "Click to enter the academic home");
  overlay.innerHTML = `
    <div class="yc-opening-screen__ambient"></div>
    <div class="yc-opening-screen__content">
      <div class="stroke-text stroke-text--hover yc-opening-word">
        <svg class="stroke-text__svg" viewBox="0 0 900 250" role="presentation" aria-hidden="true">
          <defs>
            <linearGradient id="yc-opening-stroke-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop class="yc-opening-stop yc-opening-stop--one" offset="0%"></stop>
              <stop class="yc-opening-stop yc-opening-stop--two" offset="46%"></stop>
              <stop class="yc-opening-stop yc-opening-stop--three" offset="76%"></stop>
              <stop class="yc-opening-stop yc-opening-stop--four" offset="100%"></stop>
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                values="-0.22 0;0.22 0;-0.22 0"
                dur="3.2s"
                repeatCount="indefinite"
              ></animateTransform>
            </linearGradient>
            <filter id="yc-opening-soft-glow" x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="3.2" result="blur"></feGaussianBlur>
              <feMerge>
                <feMergeNode in="blur"></feMergeNode>
                <feMergeNode in="SourceGraphic"></feMergeNode>
              </feMerge>
            </filter>
          </defs>
          <text
            class="stroke-text__fill"
            x="450"
            y="174"
            text-anchor="middle"
            textLength="790"
            lengthAdjust="spacingAndGlyphs"
          >WELCOME</text>
          <text
            class="stroke-text__stroke"
            x="450"
            y="174"
            text-anchor="middle"
            textLength="790"
            lengthAdjust="spacingAndGlyphs"
          >WELCOME</text>
        </svg>
      </div>
      <div class="yc-opening-screen__subtitle">YICHUN · ${chinese ? "学术主页" : "ACADEMIC HOME"}</div>
      <div class="yc-opening-screen__hint">${chinese ? "点击进入" : "CLICK TO ENTER"}</div>
    </div>
  `;

  let removeTimer = 0;
  let mountedAt = 0;
  let exiting = false;

  const remove = () => {
    window.clearTimeout(removeTimer);
    overlay.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
    document.body.classList.remove("yc-opening-active");
    overlay.remove();
  };

  const exit = () => {
    if (exiting) {
      return;
    }

    exiting = true;

    try {
      window.sessionStorage.setItem(storageKey, "true");
    } catch {
      // The screen still exits when session storage is restricted.
    }

    overlay.dataset.state = "exit";
    removeTimer = window.setTimeout(remove, 620);
  };

  const onKeydown = (event) => {
    if (!event.isTrusted || performance.now() - mountedAt < 500) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      exit();
    }
  };

  const onClick = (event) => {
    if (!event.isTrusted || performance.now() - mountedAt < 500) return;
    exit();
  };

  const mount = () => {
    mountedAt = performance.now();
    overlay.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
    document.body.classList.add("yc-opening-active");
    document.body.append(overlay);
    // The head cover stays in place until the real screen is mounted.
    releaseFirstPaint();
    overlay.focus({ preventScroll: true });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        overlay.dataset.state = "play";
      });
    });

  };

  mount();
})();
