/* React Bits-inspired BlurText, AnimatedContent and Magnet.
 * Native, homepage-only adaptations; attribution: /licenses/react-bits.md. */
(() => {
  "use strict";

  const body = document.body;
  if (!body?.classList.contains("yc-home-page") || body.dataset.homePolish) return;
  body.dataset.homePolish = "ready";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  if (!Element.prototype.animate || !window.IntersectionObserver) return;

  const listeners = new AbortController();
  const on = (target, name, handler, options = {}) =>
    target.addEventListener(name, handler, { ...options, signal: listeners.signal });
  const records = new Map();
  let suspended = false;
  const blocked = () => suspended || document.hidden ||
    body.classList.contains("yc-opening-active") ||
    (body.dataset.pixelState && body.dataset.pixelState !== "idle");

  // Plain HTML remains visible if this enhancement never loads or cannot run.
  const settle = (record) => {
    record.animations.forEach(animation => animation.cancel());
    record.animations = [];
    record.state = "done";
    record.element.dataset.polishReveal = "done";
    if (record.originalText !== undefined) {
      record.element.textContent = record.originalText;
      record.originalLabel === null
        ? record.element.removeAttribute("aria-label")
        : record.element.setAttribute("aria-label", record.originalLabel);
      delete record.originalText;
    }
    observer.unobserve(record.element);
  };

  const start = (record) => {
    if (record.state !== "waiting" || !record.visible || blocked()) return;
    if (reduced.matches || record.element.contains(document.activeElement)) {
      settle(record);
      return;
    }
    record.state = "playing";
    record.element.dataset.polishReveal = "playing";
    try {
      if (record.kind === "name") {
        const heading = record.element;
        const text = heading.textContent;
        record.originalText = text;
        record.originalLabel = heading.getAttribute("aria-label");
        heading.setAttribute("aria-label", text.trim());
        const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
        const segments = chinese ? Array.from(text.trim()) : text.trim().split(/(\s+)/);
        const fragment = document.createDocumentFragment();
        let index = 0;
        for (const segment of segments) {
          if (/^\s+$/.test(segment)) {
            fragment.append(document.createTextNode(segment));
            continue;
          }
          const word = document.createElement("span");
          word.className = "yc-name-word";
          word.textContent = segment;
          word.setAttribute("aria-hidden", "true");
          fragment.append(word);
        }
        heading.replaceChildren(fragment);
        for (const word of heading.children) {
          record.animations.push(word.animate([
            { filter: "blur(7px)", opacity: 0, transform: "translateY(10px)" },
            { filter: "blur(2px)", opacity: 0.75, transform: "translateY(-1px)", offset: 0.55 },
            { filter: "blur(0px)", opacity: 1, transform: "translateY(0)" },
          ], { duration: 720, delay: index++ * 70, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" }));
        }
      } else {
        record.animations.push(record.element.animate([
          { opacity: 0, translate: "0 16px" },
          { opacity: 1, translate: "0 0" },
        ], { duration: 560, delay: record.delay, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" }));
      }
      Promise.all(record.animations.map(animation => animation.finished))
        .then(() => settle(record)).catch(() => { /* Focus or motion preferences settled it. */ });
    } catch {
      settle(record);
    }
  };

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.get(entry.target);
      if (!record) continue;
      record.visible = entry.isIntersecting && entry.intersectionRatio >= 0.12;
      if (!record.visible && record.state === "playing") settle(record);
      start(record);
    }
  }, { threshold: [0, 0.12] });

  const register = (element, kind, delay = 0) => {
    if (!element) return;
    const record = { element, kind, delay, state: "waiting", visible: false, animations: [] };
    records.set(element, record);
    element.dataset.polishReveal = "waiting";
    reduced.matches ? settle(record) : observer.observe(element);
  };
  document.querySelectorAll(".yc-home-profile > h1").forEach(heading => register(heading, "name"));
  document.querySelectorAll(".friends-section").forEach(section => {
    register(section.querySelector(":scope > .flex.flex-col"), "section");
    section.querySelectorAll(":scope > .flex.flex-wrap > a").forEach((card, index) =>
      register(card, "card", Math.min(index * 45, 180)));
  });

  // Keyboard users never wait for a partially transparent target to settle.
  on(document, "focusin", event => {
    for (const record of records.values()) {
      if (record.state !== "done" && record.element.contains(event.target)) settle(record);
    }
  });

  // Tiny local attraction; no document-wide mouse loop or moving background.
  const magnets = [];
  document.querySelectorAll(".yc-electric-contact, .yc-layout-switch, .yc-audio-visualizer")
    .forEach(button => {
      let bounds = null;
      let frame = 0;
      let x = 0;
      let y = 0;
      button.classList.add("yc-magnetic-button");
      const reset = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        bounds = null;
        button.style.removeProperty("--yc-magnet-x");
        button.style.removeProperty("--yc-magnet-y");
      };
      const move = event => {
        if (!finePointer.matches || reduced.matches || event.pointerType !== "mouse" || event.buttons || blocked()) {
          reset();
          return;
        }
        bounds ||= button.getBoundingClientRect();
        x = Math.max(-3, Math.min(3, ((event.clientX - bounds.left) / bounds.width - 0.5) * 6));
        y = Math.max(-2, Math.min(2, ((event.clientY - bounds.top) / bounds.height - 0.5) * 4));
        if (!frame) frame = requestAnimationFrame(() => {
          frame = 0;
          button.style.setProperty("--yc-magnet-x", `${x.toFixed(2)}px`);
          button.style.setProperty("--yc-magnet-y", `${y.toFixed(2)}px`);
        });
      };
      on(button, "pointermove", move, { passive: true });
      for (const name of ["pointerleave", "pointercancel", "pointerdown", "click", "focus", "blur", "keydown"])
        on(button, name, reset);
      magnets.push(reset);
    });
  const resetMagnets = () => magnets.forEach(reset => reset());
  const sync = () => {
    if (blocked() || reduced.matches) resetMagnets();
    for (const record of records.values()) {
      if (record.state === "done") continue;
      if (reduced.matches || (blocked() && record.state === "playing")) settle(record);
      else start(record);
    }
  };
  const bodyObserver = new MutationObserver(sync);
  bodyObserver.observe(body, { attributes: true, attributeFilter: ["class", "data-pixel-state"] });
  on(reduced, "change", sync);
  on(finePointer, "change", resetMagnets);
  on(document, "visibilitychange", sync);
  on(document, "scroll", resetMagnets, { passive: true, capture: true });
  on(window, "resize", resetMagnets, { passive: true });
  on(window, "blur", resetMagnets);
  on(window, "pagehide", event => {
    suspended = true;
    sync();
    if (!event.persisted) {
      observer.disconnect();
      bodyObserver.disconnect();
      listeners.abort();
    }
  });
  on(window, "pageshow", () => { suspended = false; sync(); });
})();
