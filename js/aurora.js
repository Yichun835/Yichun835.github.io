(() => {
  "use strict";

  const body = document.body;

  if (!body) {
    return;
  }

  body.classList.add("yichun-subtle");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Keep the native pointer. Cursor smoke/lens assets are no longer loaded.
  const normalizePath = (pathname) =>
    pathname.replace(/index\.html$/, "").replace(/\/$/, "") || "/";
  const currentPath = normalizePath(window.location.pathname);
  const isHome = ["/", "/zh-cn", "/en"].includes(currentPath);
  const isProfile = /^(?:\/(?:zh-cn|en))?\/(?:about|research|cv|contact)$/.test(currentPath);
  // Carry a paused material phase between documents without sharing user data.
  window.ycSilkState = {
    read(fallback = 4) {
      try {
        const state = JSON.parse(window.sessionStorage.getItem("yc-silk-phase-v1"));
        const age = Date.now() - state?.savedAt;
        if (age >= 0 && age < 300000 && Number.isFinite(state.phase) && state.phase >= 0) return state.phase;
      } catch { /* Storage can be disabled; the material still renders. */ }
      return fallback;
    },
    save(phase) {
      try {
        window.sessionStorage.setItem("yc-silk-phase-v1", JSON.stringify({ phase, savedAt: Date.now() }));
      } catch { /* No persistence is required for navigation. */ }
    },
  };
  const wordmark = document.querySelector(".main-menu > a");
  if (wordmark) {
    const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
    wordmark.textContent = chinese ? "陆倚淳" : "Yichun Lu";
    wordmark.classList.add("yc-wordmark");
    wordmark.setAttribute("aria-label", chinese ? "陆倚淳 · 主页" : "Yichun Lu · Home");
  }
  if (isHome) body.classList.add("yc-home-page");
  if (isProfile) {
    body.classList.add("yc-profile-page", `yc-${currentPath.split("/").pop()}-page`);
    const raysScript = document.createElement("script");
    raysScript.src = "/js/profile-rays.js?v=continuity-3";
    raysScript.async = true;
    document.head.append(raysScript);
    // Both locales use the same share destination, but different accessible labels.
    document.querySelector('#main-content a[href*="linkedin.com/shareArticle"], #main-content a[href*="linkedin.com/sharing/share-offsite"]')
      ?.closest("section")?.classList.add("yc-template-share");
    for (const toc of document.querySelectorAll("#main-content .toc")) {
      toc.parentElement.classList.add("yc-template-toc");
    }

    if (body.classList.contains("yc-cv-page")) {
      const content = document.querySelector(".article-content");
      content?.querySelectorAll(":scope > h2").forEach((heading, index) => {
        const list = heading.nextElementSibling;
        if (list?.tagName !== "UL") return;
        const row = document.createElement("section");
        row.className = "yc-cv-section";
        if (index === 1) row.classList.add("yc-cv-education");
        heading.id ||= `yc-cv-heading-${index}`;
        row.setAttribute("aria-labelledby", heading.id);
        heading.before(row);
        row.append(heading, list);
      });
    }
  }
  body.children[1]?.classList.contains("min-h-[148px]") &&
    body.children[1].classList.add("yc-header-space");

  if (isHome) {
    // Prepare the night material when appearance is opened, before taking snapshots.
    let requestedSilk = false;
    const loadNightMaterial = (prepare = false) => {
      if (requestedSilk || (!prepare && !document.documentElement.classList.contains("dark"))) return;
      requestedSilk = true;
      const script = document.createElement("script");
      script.src = "/js/home-silk.js?v=continuity-3";
      script.async = true;
      document.head.append(script);
    };
    new MutationObserver(() => loadNightMaterial()).observe(document.documentElement, {
      attributes: true, attributeFilter: ["class"],
    });
    window.addEventListener("yc:appearance-open", () => loadNightMaterial(true));
    loadNightMaterial();
  }

  // Reuse the theme's original handler so preference saving and icons stay in sync.
  let themeTransition = null;
  let forwardingThemeClick = false;
  document.addEventListener("click", (event) => {
    const button = event.target instanceof Element
      ? event.target.closest("#appearance-switcher, #appearance-switcher-mobile")
      : null;
    if (!button || forwardingThemeClick || !document.startViewTransition || reducedMotion.matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (themeTransition) return;

    const trigger = button.closest(".yc-appearance-control")?.querySelector(".yc-appearance-toggle") || button;
    const bounds = trigger.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const viewportWidth = document.documentElement.clientWidth || innerWidth;
    const viewportHeight = innerHeight;
    const radius = Math.hypot(Math.max(x, viewportWidth - x), Math.max(y, viewportHeight - y));
    // Percentages use the snapshot's own coordinate space, including HiDPI/zoom.
    // A circle's percentage radius is relative to the normalized diagonal.
    const normalizedDiagonal = Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2;
    const applyTheme = () => {
      forwardingThemeClick = true;
      try { button.click(); } finally { forwardingThemeClick = false; }
    };
    // Close the popover before the old snapshot, so it cannot linger mid-transition.
    window.dispatchEvent(new Event("yc:before-theme-change"));
    const root = document.documentElement;
    root.style.setProperty("--yc-theme-x", `${x / viewportWidth * 100}%`);
    root.style.setProperty("--yc-theme-y", `${y / viewportHeight * 100}%`);
    root.style.setProperty("--yc-theme-radius", `${radius / normalizedDiagonal * 100 + 0.5}%`);
    const releaseTheme = () => {
      root.classList.remove("yc-theme-transitioning");
      for (const key of ["x", "y", "radius"]) root.style.removeProperty(`--yc-theme-${key}`);
      themeTransition = null;
    };
    document.documentElement.classList.add("yc-theme-transitioning");
    try {
      themeTransition = document.startViewTransition(applyTheme);
    } catch {
      releaseTheme();
      applyTheme();
      return;
    }
    // CSS owns the snapshot animation from its first frame, including the slow finish.
    // Avoid late WAAPI pseudo-element attachment, which can fall back to a sudden reveal.
    themeTransition.ready.catch(() => { /* The original theme handler still applies. */ });
    themeTransition.finished.catch(() => {}).finally(releaseTheme);
  }, { capture: true });
  const pixelStorageKey = "yc-pixel-page-transition";
  const pixelCoverDuration = 300;
  const pixelRevealDuration = 360;
  let pixelTransitionActive = false;
  const nativePageTransitions = "onpagereveal" in window && "onpageswap" in window;

  body.dataset.pageTransition = nativePageTransitions ? "native" : "pixel-swap";
  body.dataset.pixelState = "idle";
  body.dataset.arrival = "direct";

  // Cross-document snapshots keep the old page visible while the new one loads.
  // No artificial cover delay, no SPA DOM replacement, and browser history stays native.
  if (nativePageTransitions) {
    window.addEventListener("pageswap", (event) => {
      if (!event.viewTransition) return;
      event.viewTransition.ready.catch(() => {}); // Resizing/navigation may legitimately skip a snapshot.
      if (reducedMotion.matches) { event.viewTransition.skipTransition(); return; }
      body.dataset.pixelState = "cover";
    });
    window.addEventListener("pagereveal", (event) => {
      if (!event.viewTransition) return;
      event.viewTransition.ready.catch(() => {});
      body.dataset.arrival = "internal";
      body.dataset.pixelState = "reveal";
      if (reducedMotion.matches || body.classList.contains("yc-opening-active")) {
        event.viewTransition.skipTransition();
      }
      event.viewTransition.finished.catch(() => {}).finally(() => {
        body.dataset.pixelState = "idle";
      });
    });
  }

  const pixelNoise = (seed) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  const createPixelOverlay = (phase = "prepare") => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    let size = width < 720 ? 58 : 78;
    let columns = Math.max(1, Math.ceil(width / size));
    let rows = Math.max(1, Math.ceil(height / size));

    if (columns * rows > 176) {
      size = Math.ceil(size * Math.sqrt((columns * rows) / 176));
      columns = Math.max(1, Math.ceil(width / size));
      rows = Math.max(1, Math.ceil(height / size));

      while (columns * rows > 176) {
        size += 1;
        columns = Math.max(1, Math.ceil(width / size));
        rows = Math.max(1, Math.ceil(height / size));
      }
    }

    const overlay = document.createElement("div");
    overlay.className = "yc-pixel-transition";
    overlay.dataset.phase = phase;
    overlay.dataset.pattern = "diagonal-soft-random";
    overlay.dataset.grid = `${columns}x${rows}`;
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.setProperty("--yc-pixel-columns", String(columns));
    overlay.style.setProperty("--yc-pixel-rows", String(rows));

    const fragment = document.createDocumentFragment();

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const x = columns <= 1 ? 0.5 : column / (columns - 1);
        const y = rows <= 1 ? 0.5 : row / (rows - 1);
        const random = pixelNoise(index + 1);
        const order = (x * 0.55 + y * 0.45) * 0.66 + random * 0.34;
        const pixel = document.createElement("span");
        pixel.className = "yc-pixel-transition-cell";
        pixel.dataset.tone = String(Math.floor(pixelNoise(index + 19) * 3));
        pixel.style.setProperty("--yc-pixel-order", order.toFixed(3));
        fragment.append(pixel);
      }
    }

    overlay.append(fragment);
    body.append(overlay);
    return overlay;
  };

  const finishPixelTransition = (overlay) => {
    overlay.remove();
    pixelTransitionActive = false;
    body.dataset.pixelState = "idle";
    body.classList.remove("yc-pixel-transitioning", "yc-page-leaving");
  };

  const revealPixelOverlay = (overlay) => {
    overlay.dataset.phase = "covered";
    body.dataset.pixelState = "reveal";

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        overlay.dataset.phase = "reveal";
        window.setTimeout(() => finishPixelTransition(overlay), pixelRevealDuration);
      });
    });
  };

  const beginPixelCover = (onCovered) => {
    if (pixelTransitionActive || reducedMotion.matches) {
      return false;
    }

    pixelTransitionActive = true;
    body.dataset.pixelState = "cover";
    body.classList.add("yc-pixel-transitioning");
    const overlay = createPixelOverlay();

    window.requestAnimationFrame(() => {
      overlay.dataset.phase = "cover";
      window.setTimeout(() => onCovered(overlay), pixelCoverDuration);
    });

    return true;
  };

  try {
    const savedTransition = window.sessionStorage.getItem(pixelStorageKey);

    if (savedTransition) {
      window.sessionStorage.removeItem(pixelStorageKey);
      const pending = JSON.parse(savedTransition);

      if (
        pending.path === currentPath &&
        pending.search === window.location.search &&
        Date.now() - pending.started < 6000 &&
        !reducedMotion.matches &&
        !nativePageTransitions
      ) {
        body.dataset.arrival = "internal";
        pixelTransitionActive = true;
        body.classList.add("yc-pixel-transitioning");
        revealPixelOverlay(createPixelOverlay("covered"));
      }
    }
  } catch {
    // Navigation remains functional when session storage is unavailable.
  }

  for (const link of document.querySelectorAll(".main-menu a[href]")) {
    const destination = new URL(link.href, window.location.href);

    if (
      destination.origin === window.location.origin &&
      normalizePath(destination.pathname) === currentPath
    ) {
      link.setAttribute("aria-current", "page");
    }
  }

  const navigation = document.querySelector(".main-menu nav");

  if (navigation) {
    const links = Array.from(navigation.children).filter(
      (element) => element.tagName === "A",
    );
    const active = links.find((link) => link.getAttribute("aria-current") === "page");
    const pills = document.createElement("div");
    pills.className = "yc-pill-nav-items";
    const indicator = document.createElement("span");
    indicator.className = "yc-nav-indicator";
    indicator.setAttribute("aria-hidden", "true");
    navigation.classList.add("yc-pill-nav");
    navigation.prepend(pills);
    pills.append(indicator);

    for (const link of links) {
      link.classList.add("yc-nav-pill");

      const circle = document.createElement("span");
      circle.className = "yc-pill-hover-circle";
      circle.setAttribute("aria-hidden", "true");
      link.prepend(circle);

      const label = link.querySelector("span:not(.yc-pill-hover-circle)");

      if (label) {
        const stack = document.createElement("span");
        stack.className = "yc-pill-label-stack";

        const alternate = document.createElement("span");
        alternate.className = "yc-pill-label-hover";
        alternate.textContent = label.textContent.trim();
        alternate.setAttribute("aria-hidden", "true");

        label.classList.add("yc-pill-label");
        label.replaceWith(stack);
        stack.append(label, alternate);
      }

      pills.append(link);
    }

    const moveIndicator = (link) => {
      if (!link) {
        indicator.style.opacity = "0";
        return;
      }

      const navigationBox = pills.getBoundingClientRect();
      const linkBox = link.getBoundingClientRect();
      indicator.style.width = `${linkBox.width}px`;
      indicator.style.transform = `translate3d(${linkBox.left - navigationBox.left}px, -50%, 0)`;
      indicator.style.opacity = "1";
    };

    for (const link of links) {
      link.addEventListener("pointerenter", () => moveIndicator(link));
      link.addEventListener("focus", () => moveIndicator(link));
    }

    pills.addEventListener("pointerleave", () => moveIndicator(active));
    window.addEventListener("resize", () => moveIndicator(active), { passive: true });
    window.requestAnimationFrame(() => moveIndicator(active));
  }

  const mobileMenuToggle = document.querySelector("#mobile-menu-toggle");
  const mobileMenuDialog = document.querySelector(".main-menu [role=\"dialog\"]");
  const mobileMenuLabels = Array.from(
    document.querySelectorAll(".main-menu label[for=\"mobile-menu-toggle\"]"),
  );

  if (mobileMenuToggle && mobileMenuDialog && mobileMenuLabels.length >= 2) {
    const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
    const [openLabel, closeLabel] = mobileMenuLabels;
    const mobileNavigation = mobileMenuDialog.querySelector("nav");

    if (mobileNavigation) {
      mobileNavigation.classList.remove("space-y-6");

      const panel = document.createElement("section");
      panel.className = "yc-stagger-panel";

      const prelayers = document.createElement("div");
      prelayers.className = "yc-stagger-prelayers";
      prelayers.setAttribute("aria-hidden", "true");
      prelayers.innerHTML =
        '<span class="yc-stagger-prelayer"></span><span class="yc-stagger-prelayer"></span>';

      const heading = document.createElement("header");
      heading.className = "yc-stagger-heading";

      const eyebrow = document.createElement("span");
      eyebrow.className = "yc-stagger-eyebrow";
      eyebrow.textContent = chinese ? "页面导航" : "NAVIGATION";

      const title = document.createElement("strong");
      title.className = "yc-stagger-title";
      title.textContent =
        document.querySelector(".main-menu > a")?.textContent.trim() ||
        (chinese ? "学术主页" : "Academic Home");

      heading.append(eyebrow, title);

      const icon =
        '<span class="yc-stagger-toggle-icon" aria-hidden="true">' +
        '<span class="yc-stagger-icon-line"></span>' +
        '<span class="yc-stagger-icon-line"></span></span>';

      openLabel.classList.add("yc-stagger-toggle");
      openLabel.innerHTML =
        '<span class="yc-stagger-toggle-copy">' +
        `<span>${chinese ? "菜单" : "Menu"}</span>` +
        `<span>${chinese ? "关闭" : "Close"}</span></span>${icon}`;

      closeLabel.classList.add("yc-stagger-close");
      closeLabel.innerHTML =
        `<span class="yc-stagger-close-label">${chinese ? "关闭" : "Close"}</span>${icon}`;

      mobileMenuDialog.id = "yc-mobile-navigation";
      mobileMenuDialog.classList.add("yc-staggered-dialog");
      mobileMenuDialog.setAttribute("aria-label", chinese ? "页面导航菜单" : "Site navigation menu");

      for (const label of [openLabel, closeLabel]) {
        label.setAttribute("role", "button");
        label.setAttribute("aria-controls", mobileMenuDialog.id);
        label.tabIndex = 0;

        label.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            mobileMenuToggle.checked = !mobileMenuToggle.checked;
            mobileMenuToggle.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });
      }

      const items = Array.from(mobileNavigation.children);

      for (const [index, item] of items.entries()) {
        item.classList.add("yc-stagger-item");
        item.style.setProperty("--yc-stagger-index", String(index));

        const link = item.querySelector(":scope > a");

        if (link) {
          const number = document.createElement("span");
          number.className = "yc-stagger-number";
          number.setAttribute("aria-hidden", "true");
          number.textContent = String(index + 1).padStart(2, "0");
          link.append(number);
        }
      }

      mobileMenuDialog.append(prelayers, panel);
      panel.append(closeLabel, heading, mobileNavigation);

      const syncMobileMenu = () => {
        const opened = mobileMenuToggle.checked;
        mobileMenuDialog.dataset.open = String(opened);
        mobileMenuDialog.setAttribute("aria-hidden", String(!opened));
        openLabel.setAttribute("aria-expanded", String(opened));
        closeLabel.setAttribute("aria-expanded", String(opened));
        openLabel.setAttribute(
          "aria-label",
          opened
            ? chinese
              ? "关闭页面导航"
              : "Close navigation menu"
            : chinese
              ? "打开页面导航"
              : "Open navigation menu",
        );
        closeLabel.setAttribute("aria-label", chinese ? "关闭页面导航" : "Close navigation menu");
        body.classList.toggle("yc-mobile-menu-open", opened);
      };

      const dismissMobileMenu = () => {
        if (!mobileMenuToggle.checked) {
          return;
        }

        mobileMenuToggle.checked = false;
        syncMobileMenu();
        openLabel.focus();
      };

      mobileMenuToggle.addEventListener("change", syncMobileMenu);
      mobileMenuDialog.addEventListener("click", (event) => {
        if (event.target === mobileMenuDialog) {
          dismissMobileMenu();
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && mobileMenuToggle.checked) {
          event.preventDefault();
          dismissMobileMenu();
        }
      });

      syncMobileMenu();
    }
  }

  for (const button of document.querySelectorAll("#switch-layout-button")) {
    // Tailwind's important utility layer otherwise overrides the theme-aware label.
    button.classList.remove("!text-neutral", "hover:!bg-primary-500", "dark:hover:!bg-primary-700");
    button.classList.add("yc-layout-switch");
    const callout = button.parentElement?.parentElement;
    if (callout?.querySelector("#layout")) {
      callout.classList.add("yc-layout-controls");
      callout.parentElement?.classList.add("yc-home-intro");
    }
  }

  const siteControls = document.createElement("script");
  siteControls.src = "/js/site-controls.js?v=1";
  siteControls.async = true;
  document.head.append(siteControls);

  document
    .querySelector('a[href*="kelvincyyuen.com"]')
    ?.closest(".friends-section")
    ?.classList.add("yc-mentors-section");

  if (currentPath === "/" || currentPath === "/zh-cn" || currentPath === "/en") {
    const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
    const heroArtwork = document.querySelector('#hero img[src$="/img/background.svg"]');
    if (heroArtwork) {
      heroArtwork.parentElement.classList.add("yc-home-hero-backdrop");
      heroArtwork.parentElement.parentElement.classList.add("yc-home-hero-card");
    }
    const contactLabel = chinese ? "Contact" : "Contact me";
    const contactEmail =
      document.querySelector('#main-content a[href^="mailto:"]')?.getAttribute("href") ||
      "mailto:ylu336@connect.hkust-gz.edu.cn";

    const addPhotoSpotlight = (avatar, variant) => {
      if (avatar.parentElement?.classList.contains("yc-photo-spotlight")) {
        return;
      }

      const spotlight = document.createElement("span");
      const isHero = variant === "hero";
      const idleIntensity = isHero ? "0" : "0.38";
      spotlight.className = `yc-photo-spotlight yc-photo-spotlight--${variant}`;
      spotlight.dataset.active = "false";
      spotlight.style.setProperty("--yc-photo-x", "34%");
      spotlight.style.setProperty("--yc-photo-y", "24%");
      spotlight.style.setProperty("--yc-photo-intensity", idleIntensity);
      spotlight.style.setProperty("--yc-magnet-x", "0px");
      spotlight.style.setProperty("--yc-magnet-y", "0px");
      avatar.before(spotlight);
      spotlight.append(avatar);

      // The owner's portrait uses a static, material frame; no pointer animation.
      if (isHero) return;

      if (variant === "social") {
        const starField = document.createElement("span");
        const starPositions = [
          [9, 22],
          [32, 5],
          [68, 8],
          [91, 29],
          [94, 69],
          [69, 94],
          [33, 91],
          [6, 65],
        ];
        starField.className = "yc-bento-star-field";
        starField.setAttribute("aria-hidden", "true");

        starPositions.forEach(([x, y], index) => {
          const star = document.createElement("span");
          star.className = "yc-bento-star";
          star.style.setProperty("--yc-star-x", `${x}%`);
          star.style.setProperty("--yc-star-y", `${y}%`);
          star.style.setProperty("--yc-star-delay", `${index * 70}ms`);
          star.style.setProperty("--yc-star-drift", `${index % 2 === 0 ? -5 : 5}px`);
          starField.append(star);
        });

        spotlight.append(starField);
      }

      const moveSpotlight = (event) => {
        const bounds = spotlight.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * 100;
        const y = ((event.clientY - bounds.top) / bounds.height) * 100;
        spotlight.style.setProperty("--yc-photo-x", `${Math.max(0, Math.min(100, x))}%`);
        spotlight.style.setProperty("--yc-photo-y", `${Math.max(0, Math.min(100, y))}%`);
        spotlight.style.setProperty("--yc-photo-intensity", "1");
        spotlight.style.setProperty("--yc-magnet-x", `${((x - 50) * 0.075).toFixed(2)}px`);
        spotlight.style.setProperty("--yc-magnet-y", `${((y - 50) * 0.075).toFixed(2)}px`);
        spotlight.dataset.active = "true";
      };
      const resetSpotlight = () => {
        spotlight.style.setProperty("--yc-photo-intensity", idleIntensity);
        spotlight.style.setProperty("--yc-magnet-x", "0px");
        spotlight.style.setProperty("--yc-magnet-y", "0px");
        spotlight.dataset.active = "false";
      };
      spotlight.addEventListener("pointermove", moveSpotlight);
      spotlight.addEventListener("pointerleave", resetSpotlight);
    };

    for (const layoutId of ["background", "hero", "profile", "page", "card"]) {
      const layout = document.getElementById(layoutId);

      if (!layout) {
        continue;
      }

      const existingEmail = layout.querySelector('a[href^="mailto:"]');
      const socialRow = existingEmail?.parentElement;
      const header = layout.querySelector("article > header");
      const container = socialRow || header;

      if (!container) {
        continue;
      }

      container.classList.add(socialRow ? "yc-contact-social-row" : "yc-contact-header");

      const contact = document.createElement("a");
      contact.className = "yc-electric-contact";
      contact.href = contactEmail;
      contact.setAttribute("aria-label", contactLabel);
      contact.innerHTML =
        '<span class="yc-electric-contact-halo" aria-hidden="true"></span>' +
        '<svg class="yc-electric-contact-ring" viewBox="0 0 120 34" preserveAspectRatio="none" aria-hidden="true">' +
        '<rect class="yc-electric-contact-trace yc-electric-contact-trace-blue" x="1" y="1" width="118" height="32" rx="16" pathLength="100"></rect>' +
        '<rect class="yc-electric-contact-trace yc-electric-contact-trace-violet" x="1" y="1" width="118" height="32" rx="16" pathLength="100"></rect>' +
        '</svg><span class="yc-electric-contact-content">' +
        '<svg class="yc-electric-contact-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">' +
        '<path d="M17.25 3.05 2.98 8.86l5.57 2.08 2.08 5.57 6.62-13.46Z" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"></path>' +
        '<path d="m8.55 10.94 4.36-4.13" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"></path>' +
        `</svg><span>${contactLabel}</span></span>`;
      container.append(contact);
      existingEmail?.remove();
    }

    for (const avatar of document.querySelectorAll(
      "#main-content img.h-36.w-36.rounded-full[alt]",
    )) {
      avatar.parentElement.classList.add("yc-home-profile");
      const affiliation = avatar.parentElement.querySelector(":scope > h2");
      if (affiliation?.textContent.trim() === "USTGZ") {
        affiliation.textContent = chinese ? "博士生 · 香港科技大学（广州）" : "PhD Student · HKUST (Guangzhou)";
      }
      addPhotoSpotlight(avatar, "hero");
      if (avatar.getAttribute("src")?.includes("yichun-home-portrait.jpg")) {
        const crop = document.createElement("span");
        crop.className = "yc-home-avatar-crop";
        avatar.before(crop);
        crop.append(avatar);
      }
    }

    for (const avatar of document.querySelectorAll(".friends-section img.rounded-full")) {
      addPhotoSpotlight(avatar, "social");
    }

    for (const section of document.querySelectorAll(".friends-section")) {
      section.classList.add("yc-bento-section");
      section.style.setProperty("--yc-bento-x", "50%");
      section.style.setProperty("--yc-bento-y", "50%");

      section.addEventListener("pointermove", (event) => {
        const bounds = section.getBoundingClientRect();
        section.style.setProperty("--yc-bento-x", `${event.clientX - bounds.left}px`);
        section.style.setProperty("--yc-bento-y", `${event.clientY - bounds.top}px`);
        section.dataset.spotlight = "active";
      });
      section.addEventListener("pointerleave", () => {
        section.dataset.spotlight = "idle";
      });
    }

    // Loads after this synchronous setup has created the profile and audio controls.
    const polish = document.createElement("script");
    polish.src = "/js/home-polish.js?v=quiet-1";
    polish.async = true;
    document.head.append(polish);
  }

  if (currentPath === "/about" || currentPath === "/zh-cn/about") {
    const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
    const introColumn = document.querySelector(".article-content .about-grid > div:first-child");

    if (introColumn) {
      const phrases = chinese
        ? ["博士生", "计算社会科学研究者", "数据探索者"]
        : ["PhD Student", "Social Scientist", "Data Explorer"];
      const segmenter =
        typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
          ? new Intl.Segmenter(chinese ? "zh-CN" : "en", { granularity: "grapheme" })
          : null;
      const stage = document.createElement("div");
      const visible = document.createElement("span");
      const live = document.createElement("span");
      let phraseIndex = 0;
      let rotationTimer = 0;

      stage.className = "yc-rotating-intro";
      stage.dataset.component = "rotating-text";
      stage.dataset.state = "ready";
      stage.innerHTML = `<span class="yc-rotating-prefix">${chinese ? "我是" : "I'm a"}</span>`;
      visible.className = "yc-rotating-window";
      visible.setAttribute("aria-hidden", "true");
      live.className = "yc-rotating-sr";
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      live.setAttribute("aria-atomic", "true");
      stage.append(visible, live);

      const splitCharacters = (text) =>
        segmenter
          ? Array.from(segmenter.segment(text), (segment) => segment.segment)
          : Array.from(text);

      const renderPhrase = (phrase, animate = true) => {
        const word = document.createElement("span");
        word.className = "yc-rotating-word";
        word.dataset.state = animate ? "entering" : "steady";

        splitCharacters(phrase).forEach((character, index) => {
          const characterElement = document.createElement("span");
          characterElement.className = "yc-rotating-character";
          characterElement.textContent = character === " " ? "\u00a0" : character;
          characterElement.style.setProperty("--yc-character-delay", `${index * 22}ms`);
          word.append(characterElement);
        });

        visible.replaceChildren(word);
        live.textContent = phrase;
        stage.dataset.phrase = phrase;
        stage.dataset.index = String(phraseIndex);
      };

      const rotatePhrase = () => {
        const currentWord = visible.firstElementChild;

        if (!currentWord) {
          renderPhrase(phrases[phraseIndex]);
          return;
        }

        stage.dataset.state = "rotating";
        currentWord.dataset.state = "leaving";
        window.setTimeout(() => {
          phraseIndex = (phraseIndex + 1) % phrases.length;
          renderPhrase(phrases[phraseIndex]);
          stage.dataset.state = "ready";
        }, 270);
      };

      const startRotation = () => {
        if (!rotationTimer && !document.hidden && !reducedMotion.matches) {
          rotationTimer = window.setInterval(rotatePhrase, 2400);
        }
      };

      const stopRotation = () => {
        if (rotationTimer) {
          window.clearInterval(rotationTimer);
          rotationTimer = 0;
        }
      };

      renderPhrase(phrases[0], false);
      introColumn.prepend(stage);
      startRotation();

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          stopRotation();
        } else {
          startRotation();
        }
      });
      reducedMotion.addEventListener("change", () => {
        if (reducedMotion.matches) {
          stopRotation();
        } else {
          startRotation();
        }
      });
    }

    const aboutPhoto = document.querySelector(".article-content img.about-photo");

    if (aboutPhoto && !aboutPhoto.parentElement?.classList.contains("yc-about-pixel-photo")) {
      const photoCard = document.createElement("span");
      const pixelLayer = document.createElement("span");
      const pixelLabel = document.createElement("span");
      const pixelGrid = document.createElement("span");
      const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
      const pixelText = chinese ? "我" : "ME";
      const activationDelay = 0;
      const transitionDuration = 1400;
      const pixelDuration = 450;
      const pixelSpread = transitionDuration - pixelDuration;
      const pixelColumns = 12;
      const pixelRows = 14;
      let activationTimer = 0;
      let suppressPixelUntilLeave = false;

      photoCard.className = "yc-about-pixel-photo yc-pixelated-photo-card";
      photoCard.dataset.effect = "pixelated-text-swap";
      photoCard.dataset.state = "idle";
      photoCard.dataset.label = pixelText;
      photoCard.dataset.activationDelay = String(activationDelay);
      photoCard.dataset.transitionDuration = String(transitionDuration);
      photoCard.dataset.pixelDuration = String(pixelDuration);
      pixelLayer.className = "yc-pixelated-photo-layer";
      pixelLayer.setAttribute("aria-hidden", "true");
      pixelLabel.className = "yc-pixelated-photo-label";
      pixelLabel.textContent = pixelText;
      pixelGrid.className = "yc-pixelated-photo-pixels";

      for (let index = 0; index < pixelColumns * pixelRows; index += 1) {
        const row = Math.floor(index / pixelColumns);
        const column = index % pixelColumns;
        const random = pixelNoise(index + 137);
        const pixelDelay = pixelNoise(index + 1) * pixelSpread;
        const pixel = document.createElement("span");
        pixel.className = "yc-pixelated-photo-pixel";
        pixel.dataset.tone = String((row * 3 + column * 5) % 4);
        pixel.style.left = `${column * (100 / pixelColumns)}%`;
        pixel.style.top = `${row * (100 / pixelRows)}%`;
        pixel.style.width = `${100 / pixelColumns - 0.18}%`;
        pixel.style.height = `${100 / pixelRows - 0.18}%`;
        pixel.style.setProperty("--yc-photo-pixel-delay", `${Math.round(pixelDelay)}ms`);
        pixel.style.setProperty("--yc-photo-pixel-drift", `${((random - 0.5) * 12).toFixed(2)}%`);
        pixelGrid.append(pixel);
      }

      aboutPhoto.before(photoCard);
      photoCard.append(aboutPhoto);
      pixelLayer.append(pixelLabel, pixelGrid);
      photoCard.append(pixelLayer);

      const cancelActivation = () => {
        if (activationTimer) {
          window.clearTimeout(activationTimer);
          activationTimer = 0;
        }
      };

      const scheduleActivation = () => {
        cancelActivation();
        photoCard.dataset.state = "pending";
        activationTimer = window.setTimeout(() => {
          activationTimer = 0;
          photoCard.dataset.state = "active";
        }, activationDelay);
      };

      photoCard.addEventListener("pointerenter", () => {
        if (precisePointer.matches && !suppressPixelUntilLeave) {
          scheduleActivation();
        }
      });
      photoCard.addEventListener("pointerleave", () => {
        cancelActivation();
        suppressPixelUntilLeave = false;
        photoCard.dataset.state = "idle";
      });
      aboutPhoto.addEventListener("click", () => {
        cancelActivation();
        suppressPixelUntilLeave = true;
        photoCard.dataset.state = "idle";
      });
    }
  }

  if (body.classList.contains("yc-research-page")) {
    // Keep the original headings, interests, text and deep links intact.
    // Shared silk backdrop; the interests remain a non-interactive peer list.
    document.querySelector(".article-content")?.classList.add("yc-research-editorial");
  }

  if (/\/(?:zh-cn\/)?contact$/.test(currentPath)) {
    body.classList.add("yc-contact-page");
    buildContactLoop();
    const heading = document.querySelector("#single_header h1");

    if (heading) {
      const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
      const label = "CONTACT";
      const stage = document.createElement("div");
      stage.className = "yc-particle-text particle-text";
      stage.dataset.state = "assembling";
      stage.dataset.palette = "neutral-ink,white";

      const canvas = document.createElement("canvas");
      canvas.className = "yc-particle-text__canvas particle-text__canvas";
      canvas.setAttribute("aria-hidden", "true");

      const context = canvas.getContext("2d", { alpha: true, desynchronized: true });

      if (context) {
        const accessible = document.createElement("span");
        accessible.className = "yc-particle-text__sr particle-text__sr";
        accessible.textContent = label;

        const caption = document.createElement("span");
        caption.className = "yc-particle-text__caption";
        caption.setAttribute("aria-hidden", "true");
        caption.textContent = chinese ? "期待与你交流" : "LET'S CONNECT";

        stage.append(canvas, accessible, caption);
        heading.classList.add("yc-particle-heading");
        heading.replaceChildren(stage);

        const mask = document.createElement("canvas");
        const maskContext = mask.getContext("2d", { willReadFrequently: true });
        const pointer = { x: -1000, y: -1000, active: false };
        let points = [];
        let width = 0;
        let height = 0;
        let frame = 0;
        let lastDraw = 0;
        let lastParticleTime = 0;
        let assembledAt = performance.now();
        let visible = true;
        let suspended = false;
        const assemblyDuration = 900;
        const assemblyEase = (progress) => 1 - (1 - Math.max(0, Math.min(1, progress))) ** 3;
        const particleDamping = (ease, milliseconds) => 1 - (1 - ease) ** (milliseconds / (1000 / 60));
        const canRunParticles = () => visible && !suspended && !document.hidden && !reducedMotion.matches
          && !document.documentElement.classList.contains("yc-theme-transitioning");

        const drawParticleText = (time = performance.now()) => {
          context.clearRect(0, 0, width, height);
          const delta = lastParticleTime ? Math.min(50, Math.max(0, time - lastParticleTime)) : 1000 / 60;
          lastParticleTime = time;

          const dark = document.documentElement.classList.contains("dark");
          const palette = dark
            ? ["228,228,226", "245,245,243", "201,203,202"]
            : ["55,61,65", "79,85,88", "103,108,110"];
          const progress = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (time - assembledAt) / assemblyDuration));
          const assembly = assemblyEase(progress);
          const settled = progress >= 1;
          const finishingAssembly = settled && stage.dataset.state === "assembling";

          if (stage.dataset.state !== (settled ? "interactive" : "assembling")) {
            stage.dataset.state = settled ? "interactive" : "assembling";
          }

          for (const point of points) {
            const wave = reducedMotion.matches
              ? 0
              : Math.sin(time * 0.00135 + point.phase) * 0.55;
            let targetX = point.homeX + wave * 0.58;
            let targetY = point.homeY + wave * 0.34;

            if (pointer.active && !reducedMotion.matches) {
              const deltaX = point.homeX - pointer.x;
              const deltaY = point.homeY - pointer.y;
              const distance = Math.hypot(deltaX, deltaY);

              if (distance < 48 && distance > 0.1) {
                const force = (1 - distance / 48) ** 2 * 15;
                targetX += (deltaX / distance) * force;
                targetY += (deltaY / distance) * force;
              }
            }

            if (reducedMotion.matches || finishingAssembly) {
              point.x = targetX;
              point.y = targetY;
            } else if (!settled) {
              // A bounded, time-based formation avoids the old frame-rate-dependent long tail.
              point.x = point.startX + (targetX - point.startX) * assembly;
              point.y = point.startY + (targetY - point.startY) * assembly;
            } else {
              const damping = particleDamping(point.ease, delta);
              point.x += (targetX - point.x) * damping;
              point.y += (targetY - point.y) * damping;
            }

            context.fillStyle = `rgb(${palette[point.tone]})`;
            context.globalAlpha = Math.min(1, point.opacity + wave * 0.08) * Math.min(1, progress * 3.5);
            context.beginPath();
            context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
            context.fill();
          }

          context.globalAlpha = 1;
        };

        const renderParticleText = (time) => {
          if (!canRunParticles()) {
            frame = 0;
            lastParticleTime = 0;
            return;
          }

          const interval = time - assembledAt < assemblyDuration || pointer.active ? 1000 / 60 : 1000 / 30;
          if (time - lastDraw >= interval - 0.5) {
            lastDraw = time;
            drawParticleText(time);
          }

          frame = window.requestAnimationFrame(renderParticleText);
        };

        const refreshParticleText = () => {
          if (!canRunParticles()) {
            window.cancelAnimationFrame(frame);
            frame = 0;
            lastParticleTime = 0;
          }

          // Paint the new palette before the theme snapshot even when animation is paused.
          if (visible && !suspended && !document.hidden) drawParticleText();
          if (canRunParticles() && !frame) {
            frame = window.requestAnimationFrame(renderParticleText);
          }
        };

        const resizeParticleText = () => {
          if (!maskContext) {
            return;
          }

          const bounds = stage.getBoundingClientRect();
          const nextWidth = Math.max(1, Math.round(bounds.width));
          const nextHeight = Math.max(1, Math.round(bounds.height));

          if (nextWidth === width && nextHeight === height && points.length) {
            return;
          }

          const reflow = points.length > 0;
          width = nextWidth;
          height = nextHeight;
          const ratio = Math.min(window.devicePixelRatio || 1, 1.45);
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round(height * ratio);
          context.setTransform(ratio, 0, 0, ratio, 0, 0);
          mask.width = width;
          mask.height = height;

          let size = Math.min(chinese ? 94 : 86, height * 0.64, width * (chinese ? 0.25 : 0.2));
          const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          maskContext.font = `750 ${size}px ${fontFamily}`;

          while (maskContext.measureText(label).width > width * 0.87 && size > 24) {
            size *= 0.94;
            maskContext.font = `750 ${size}px ${fontFamily}`;
          }

          maskContext.fillStyle = "#fff";
          maskContext.textAlign = "center";
          maskContext.textBaseline = "middle";
          maskContext.fillText(label, width / 2, height * 0.435);

          const pixels = maskContext.getImageData(0, 0, width, height).data;
          const step = width < 460 ? 3 : 4;
          const sampled = [];

          for (let y = step; y < height; y += step) {
            for (let x = step; x < width; x += step) {
              if (pixels[(y * width + x) * 4 + 3] > 135) {
                sampled.push({ x, y });
              }
            }
          }

          const stride = Math.max(1, Math.ceil(sampled.length / 1250));
          points = sampled.filter((_, index) => index % stride === 0).map((point, index) => {
            const random = pixelNoise(index + 67);
            const startX = point.x + (pixelNoise(index + 13) - 0.5) * 72;
            const startY = point.y + (pixelNoise(index + 29) - 0.5) * 44;

            return {
              homeX: point.x,
              homeY: point.y,
              startX, startY,
              x: reflow ? point.x : startX,
              y: reflow ? point.y : startY,
              radius: 0.78 + pixelNoise(index + 41) * 0.62,
              opacity: 0.65 + random * 0.34,
              phase: random * Math.PI * 2,
              tone: Math.min(2, Math.floor((point.x / width) * 3)),
              ease: 0.075 + pixelNoise(index + 91) * 0.055,
            };
          });

          stage.dataset.points = String(points.length);
          // A resize should reflow the completed heading, not replay its entrance.
          assembledAt = performance.now() - (reflow ? assemblyDuration : 0);
          lastParticleTime = 0;
          refreshParticleText();
        };

        stage.addEventListener("pointermove", (event) => {
          const bounds = stage.getBoundingClientRect();
          pointer.x = event.clientX - bounds.left;
          pointer.y = event.clientY - bounds.top;
          pointer.active = true;
        });
        stage.addEventListener("pointerleave", () => {
          pointer.active = false;
        });

        if (typeof IntersectionObserver === "function") {
          new IntersectionObserver(
            ([entry]) => {
              visible = entry.isIntersecting;
              refreshParticleText();
            },
            { rootMargin: "80px 0px" },
          ).observe(stage);
        }

        if (typeof ResizeObserver === "function") {
          new ResizeObserver(resizeParticleText).observe(stage);
        } else {
          window.addEventListener("resize", resizeParticleText, { passive: true });
        }

        document.addEventListener("visibilitychange", refreshParticleText);
        reducedMotion.addEventListener("change", refreshParticleText);
        new MutationObserver(refreshParticleText).observe(document.documentElement, {
          attributes: true, attributeFilter: ["class"],
        });
        window.addEventListener("pagehide", () => { suspended = true; refreshParticleText(); });
        window.addEventListener("pageshow", () => { suspended = false; refreshParticleText(); });
        resizeParticleText();
      }
    }

    function buildContactLoop() {
      const contactList = document
        .querySelector('.article-content a[href^="mailto:ylu336@connect.hkust-gz.edu.cn"]')
        ?.closest("ul");

      if (!contactList) {
        return;
      }

      const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
      const loop = document.createElement("section");
      const track = document.createElement("div");
      const contacts = [
        {
          label: chinese ? "邮箱" : "Email",
          detail: "ylu336@connect.hkust-gz.edu.cn",
          href: "mailto:ylu336@connect.hkust-gz.edu.cn",
          icon:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 6.5h17v11h-17v-11Z" stroke="currentColor" stroke-width="1.55"/><path d="m4.2 7.3 7.8 6 7.8-6" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/></svg>',
        },
        {
          label: "GitHub",
          detail: "@Yichun835",
          href: "https://github.com/Yichun835",
          external: true,
          icon:
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.7a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .8.1-.7.4-1.2.7-1.4-2.3-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.8 1a9.7 9.7 0 0 1 5 0c2-1.3 2.8-1 2.8-1a3.6 3.6 0 0 1 .1 2.7 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.7 5 .4.3.7 1 .7 1.9v2.8c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.7Z"/></svg>',
        },
        {
          label: chinese ? "个人主页" : "Homepage",
          detail: "yichun835.github.io",
          href: chinese ? "/zh-cn/" : "/",
          icon:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.5"/><path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.4 5.1 3.4 8.5S14.2 18.2 12 20.5C9.8 18.2 8.6 15.4 8.6 12S9.8 5.8 12 3.5Z" stroke="currentColor" stroke-width="1.35"/></svg>',
        },
        {
          label: "HKUST(GZ)",
          detail: "UGOD · CSS",
          href: "https://www.hkust-gz.edu.cn/",
          external: true,
          icon:
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20h16M6 20V9.5h12V20M4.7 9.5 12 4l7.3 5.5H4.7Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9.2 13h5.6M9.2 16.5h5.6" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>',
        },
      ];

      const createContactList = (duplicate = false) => {
        const list = document.createElement("div");
        list.className = "logoloop__list yc-contact-logoloop-list";

        if (duplicate) {
          list.setAttribute("aria-hidden", "true");
        }

        for (const contact of contacts) {
          const item = document.createElement("span");
          const link = document.createElement("a");
          item.className = "logoloop__item yc-contact-logoloop-item";
          link.className = "logoloop__link yc-contact-logoloop-link";
          link.href = contact.href;
          link.setAttribute("aria-label", `${contact.label}: ${contact.detail}`);
          link.innerHTML =
            `<span class="yc-contact-logoloop-icon">${contact.icon}</span>` +
            `<span class="yc-contact-logoloop-copy"><strong>${contact.label}</strong><small>${contact.detail}</small></span>`;
          link.addEventListener("click", () => {
            window.setTimeout(() => link.blur(), 0);
          });

          if (contact.external) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }

          if (duplicate) {
            link.tabIndex = -1;
          }

          if (contact.href.startsWith("mailto:")) {
            const pill = document.createElement("span");
            pill.className = "yc-contact-email-pill";
            const copy = document.createElement("button");
            copy.type = "button";
            copy.className = "yc-email-copy";
            copy.dataset.copyEmail = contact.detail;
            copy.setAttribute("aria-label", chinese ? "复制邮箱地址" : "Copy email address");
            copy.title = chinese ? "复制邮箱地址" : "Copy email address";
            copy.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.5"/></svg>';
            if (duplicate) copy.tabIndex = -1;
            pill.append(link, copy);
            item.append(pill);
          } else item.append(link);
          list.append(item);
        }

        return list;
      };

      loop.id = "yc-contact-loop";
      loop.className = "logoloop logoloop--fade logoloop--scale-hover yc-contact-logoloop";
      loop.dataset.component = "contact-logo-loop";
      loop.setAttribute(
        "aria-label",
        chinese ? "循环展示的联系方式" : "Looping contact methods",
      );
      track.className = "logoloop__track yc-contact-logoloop-track";
      track.append(createContactList(), createContactList(true));
      const status = document.createElement("span");
      status.className = "yc-sr-only";
      status.id = "yc-copy-status";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      loop.append(track, status);
      contactList.replaceWith(loop);

      const shareRow = loop.closest(".article-content")?.nextElementSibling;

      if (shareRow?.matches("section") && shareRow.querySelector('a[title*="LinkedIn"]')) {
        shareRow.classList.add("yc-contact-share-row");
        shareRow.hidden = true;
        shareRow.setAttribute("aria-hidden", "true");
      }
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("#switch-layout-button");

      if (!button || reducedMotion.matches || typeof window.switchHomeLayout !== "function") {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      beginPixelCover((overlay) => {
        window.switchHomeLayout();
        window.dispatchEvent(new Event("resize"));
        revealPixelOverlay(overlay);
      });
    },
    true,
  );

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");

    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      reducedMotion.matches
    ) {
      return;
    }

    const destination = new URL(link.href, window.location.href);

    if (
      destination.origin !== window.location.origin ||
      (destination.pathname === window.location.pathname &&
        destination.search === window.location.search)
    ) {
      return;
    }

    if (nativePageTransitions) return;

    event.preventDefault();

    beginPixelCover(() => {
      body.classList.add("yc-page-leaving");

      try {
        window.sessionStorage.setItem(
          pixelStorageKey,
          JSON.stringify({
            path: normalizePath(destination.pathname),
            search: destination.search,
            started: Date.now(),
          }),
        );
      } catch {
        // The outgoing pixel cover still works without session storage.
      }

      window.location.assign(destination.href);
    });
  });

  window.addEventListener("pageshow", (event) => {
    body.classList.remove("yc-page-leaving");
    if (nativePageTransitions && event.persisted) body.dataset.pixelState = "idle";

    if (event.persisted) {
      document.querySelectorAll(".yc-pixel-transition").forEach(finishPixelTransition);
    }
  });

  const layer = document.querySelector("#background-image")?.parentElement;

  if (!layer) {
    return;
  }

  // Decoration lives outside the page/layout containers, so scrolling and layout
  // transitions cannot move, blur or resize the star field.
  layer.classList.add("yc-legacy-backdrop");

  const showcase = currentPath === "/" || currentPath === "/zh-cn" || currentPath === "/en";

  if (showcase) {
    const lowerSections = document.querySelector(".friends-section")?.parentElement;

    if (lowerSections) {
      lowerSections.classList.add("yc-lower-aurora-section");

      const stage = document.createElement("div");
      stage.className = "yc-lower-aurora";
      stage.dataset.renderer = "css";
      stage.dataset.active = "false";
      stage.dataset.palette = "deep-blue,ice-blue,soft-violet";
      stage.setAttribute("aria-hidden", "true");

      const surface = document.createElement("canvas");
      surface.className = "yc-lower-aurora-canvas";
      stage.append(surface);
      lowerSections.prepend(stage);
      stage.style.width = `${document.documentElement.clientWidth}px`;

      const gl = surface.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "low-power",
      });

      if (gl) {
        const vertexSource = `#version 300 es
          void main() {
            vec2 point = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
            gl_Position = vec4(point * 2.0 - 1.0, 0.0, 1.0);
          }
        `;

        const fragmentSource = `#version 300 es
          precision highp float;

          uniform float uTime;
          uniform vec2 uResolution;
          uniform vec3 uColorStops[3];

          out vec4 fragColor;

          vec3 permute(vec3 value) {
            return mod(((value * 34.0) + 1.0) * value, 289.0);
          }

          float snoise(vec2 value) {
            const vec4 constants = vec4(
              0.211324865405187,
              0.366025403784439,
              -0.577350269189626,
              0.024390243902439
            );

            vec2 cell = floor(value + dot(value, constants.yy));
            vec2 offset = value - cell + dot(cell, constants.xx);
            vec2 simplex = offset.x > offset.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 neighbors = offset.xyxy + constants.xxzz;
            neighbors.xy -= simplex;
            cell = mod(cell, 289.0);

            vec3 permutation = permute(
              permute(cell.y + vec3(0.0, simplex.y, 1.0)) +
              cell.x + vec3(0.0, simplex.x, 1.0)
            );

            vec3 attenuation = max(
              0.5 - vec3(dot(offset, offset), dot(neighbors.xy, neighbors.xy), dot(neighbors.zw, neighbors.zw)),
              0.0
            );
            attenuation *= attenuation;
            attenuation *= attenuation;

            vec3 direction = 2.0 * fract(permutation * constants.www) - 1.0;
            vec3 height = abs(direction) - 0.5;
            vec3 origin = floor(direction + 0.5);
            vec3 gradient = direction - origin;
            attenuation *= 1.79284291400159 - 0.85373472095314 * (gradient * gradient + height * height);

            vec3 projection;
            projection.x = gradient.x * offset.x + height.x * offset.y;
            projection.yz = gradient.yz * neighbors.xz + height.yz * neighbors.yw;
            return 130.0 * dot(attenuation, projection);
          }

          void main() {
            vec2 uv = gl_FragCoord.xy / uResolution;
            vec3 ramp = uv.x < 0.5
              ? mix(uColorStops[0], uColorStops[1], uv.x * 2.0)
              : mix(uColorStops[1], uColorStops[2], (uv.x - 0.5) * 2.0);

            float wave = snoise(vec2(uv.x * 2.15 + uTime * 0.11, uTime * 0.24));
            float elevation = exp(wave * 0.43);
            float height = uv.y * 1.76 - elevation + 0.42;
            float intensity = max(0.0, height * 0.73);
            float alpha = smoothstep(0.055, 0.40, intensity);
            alpha *= 1.0 - smoothstep(0.72, 1.0, uv.y);
            alpha *= 0.76;

            vec3 color = ramp * (0.36 + min(intensity, 0.72));
            fragColor = vec4(color * alpha, alpha);
          }
        `;

        const compile = (type, source) => {
          const shader = gl.createShader(type);

          if (!shader) {
            return null;
          }

          gl.shaderSource(shader, source);
          gl.compileShader(shader);

          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
          }

          return shader;
        };

        const vertex = compile(gl.VERTEX_SHADER, vertexSource);
        const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
        const program = vertex && fragment ? gl.createProgram() : null;

        if (program && vertex && fragment) {
          gl.attachShader(program, vertex);
          gl.attachShader(program, fragment);
          gl.linkProgram(program);

          if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            stage.dataset.renderer = "webgl2";
            gl.useProgram(program);
            gl.bindVertexArray(gl.createVertexArray());
            gl.clearColor(0, 0, 0, 0);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

            const timeUniform = gl.getUniformLocation(program, "uTime");
            const resolutionUniform = gl.getUniformLocation(program, "uResolution");
            const colorsUniform = gl.getUniformLocation(program, "uColorStops[0]");
            gl.uniform3fv(
              colorsUniform,
              new Float32Array([0.17, 0.39, 0.86, 0.26, 0.67, 0.89, 0.55, 0.50, 0.91]),
            );

            let active = false;
            let auroraFrame = 0;
            const canAnimateLower = () => active && !document.hidden && !reducedMotion.matches
              && !document.documentElement.classList.contains("dark");

            const render = (time = performance.now()) => {
              gl.viewport(0, 0, surface.width, surface.height);
              gl.clear(gl.COLOR_BUFFER_BIT);
              gl.uniform1f(timeUniform, time * 0.00057);
              gl.uniform2f(resolutionUniform, surface.width, surface.height);
              gl.drawArrays(gl.TRIANGLES, 0, 3);

              if (canAnimateLower()) {
                auroraFrame = window.requestAnimationFrame(render);
              } else {
                auroraFrame = 0;
              }
            };

            const resizeLowerAurora = () => {
              stage.style.width = `${document.documentElement.clientWidth}px`;

              const ratio = Math.min(window.devicePixelRatio || 1, 1.2);
              surface.width = Math.max(1, Math.round(stage.clientWidth * ratio));
              surface.height = Math.max(1, Math.round(stage.clientHeight * ratio));

              if (auroraFrame) {
                window.cancelAnimationFrame(auroraFrame);
                auroraFrame = 0;
              }

              render();
            };

            const refresh = () => {
              if (canAnimateLower() && !auroraFrame) {
                auroraFrame = window.requestAnimationFrame(render);
              } else if (!canAnimateLower() && auroraFrame) {
                window.cancelAnimationFrame(auroraFrame);
                auroraFrame = 0;
                render();
              }
            };

            if (typeof IntersectionObserver === "function") {
              new IntersectionObserver(
                ([entry]) => {
                  active = entry.isIntersecting;
                  stage.dataset.active = String(active);
                  refresh();
                },
                { rootMargin: "120px 0px" },
              ).observe(lowerSections);
            } else {
              active = true;
              stage.dataset.active = "true";
            }

            if (typeof ResizeObserver === "function") {
              new ResizeObserver(resizeLowerAurora).observe(lowerSections);
            }

            window.addEventListener("resize", resizeLowerAurora, { passive: true });
            document.addEventListener("visibilitychange", refresh);
            reducedMotion.addEventListener("change", refresh);
            new MutationObserver(refresh).observe(document.documentElement, {
              attributes: true, attributeFilter: ["class"],
            });
            resizeLowerAurora();
            refresh();
          }

          gl.deleteShader(vertex);
          gl.deleteShader(fragment);
        }
      }
    }
  }

  const canvas = document.createElement("canvas");
  canvas.id = "yc-particle-field";
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.visual = "fixed-twinkling-stars";
  body.prepend(canvas);

  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    canvas.remove();
    return;
  }

  const emblemCanvas = showcase ? document.createElement("canvas") : null;
  const emblemContext = emblemCanvas?.getContext("2d", { alpha: true }) || null;

  if (emblemCanvas && emblemContext) {
    emblemCanvas.className = "yc-puppy-particle-emblem";
    emblemCanvas.dataset.visual = "deep-particle-filled-puppy";
    emblemCanvas.dataset.layer = "background";
    emblemCanvas.setAttribute("aria-hidden", "true");
    body.append(emblemCanvas);
  }

  const particles = [];
  const emblemPoints = [];
  const pointer = {
    x: -1000,
    y: -1000,
    active: false,
  };
  const particlePalette = ["160, 220, 246", "182, 201, 255", "225, 188, 250"];
  const glowSprites = particlePalette.map((color) => {
    const sprite = document.createElement("canvas");
    sprite.width = 48;
    sprite.height = 48;

    const glow = sprite.getContext("2d");

    if (!glow) {
      return null;
    }

    const gradient = glow.createRadialGradient(24, 24, 0, 24, 24, 23);
    gradient.addColorStop(0, `rgba(${color}, 0.92)`);
    gradient.addColorStop(0.13, `rgba(${color}, 0.48)`);
    gradient.addColorStop(0.42, `rgba(${color}, 0.12)`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    glow.fillStyle = gradient;
    glow.fillRect(0, 0, 48, 48);

    return sprite;
  });

  let width = 0;
  let height = 0;
  let frame = 0;
  let lastStarFrame = 0;
  let assemblyStarted = 0;
  let audioLevel = 0;
  const emblemLayout = { width: 0, centerX: 0, centerY: 0, mode: "compact-corner" };

  const positionEmblem = () => {
    const compact = width < 720;
    const audioBox = document.querySelector(".yc-audio-dock")?.getBoundingClientRect();
    emblemLayout.width = compact ? 58 : 68;
    emblemLayout.centerX = audioBox?.width
      ? audioBox.left + audioBox.width / 2
      : width - (compact ? 18 : 26) - emblemLayout.width / 2;
    emblemLayout.centerY = audioBox?.height
      ? audioBox.top - 10 - emblemLayout.width / 2
      : height - (compact ? 69 : 80) - emblemLayout.width / 2;
    emblemLayout.mode = "listen-centered";

    if (emblemCanvas) {
      emblemCanvas.style.left = `${Math.round(emblemLayout.centerX - emblemLayout.width / 2)}px`;
      emblemCanvas.style.top = `${Math.round(emblemLayout.centerY - emblemLayout.width / 2)}px`;
      emblemCanvas.style.width = `${emblemLayout.width}px`;
      emblemCanvas.style.height = `${emblemLayout.width}px`;
      emblemCanvas.dataset.placement = emblemLayout.mode;
    }

    canvas.dataset.emblemPlacement = emblemLayout.mode;
    canvas.dataset.emblemBounds = [
      Math.round(emblemLayout.centerX - emblemLayout.width / 2),
      Math.round(emblemLayout.centerY - emblemLayout.width / 2),
      Math.round(emblemLayout.width),
    ].join(",");
  };

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;

    const ratio = Math.min(window.devicePixelRatio || 1, 1.35);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    positionEmblem();

    if (emblemCanvas && emblemContext) {
      emblemCanvas.width = Math.round(emblemLayout.width * ratio);
      emblemCanvas.height = Math.round(emblemLayout.width * ratio);
      emblemContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    const count = Math.min(92, Math.max(38, Math.round((width * height) / 12500)));

    while (particles.length < count) {
      const depth = Math.random() * 0.78 + 0.22;

      particles.push({
        u: Math.random(),
        v: Math.random(),
        radius: 0.42 + depth * 0.77,
        phase: Math.random() * Math.PI * 2,
        period: 3.8 + Math.random() * 7.2,
        duration: 0.75 + Math.random() * 1.1,
        seed: Math.random() * 1000,
        depth,
        tone: Math.floor(Math.random() * particlePalette.length),
        glow: Math.random() > 0.87,
      });
    }

    particles.length = count;
  };

  const drawGlow = (x, y, radius, tone, opacity) => {
    const sprite = glowSprites[tone];

    if (!sprite) {
      return;
    }

    const size = radius * 8.5;
    context.globalAlpha = opacity;
    context.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    context.globalAlpha = 1;
  };

  const drawEmblem = (time, dark) => {
    if (!emblemContext || !emblemPoints.length || width < 720) {
      return;
    }

    const compact = width < 720;
    const emblemWidth = emblemLayout.width;
    const cell = emblemWidth / 60;
    const centerX = emblemWidth / 2;
    const centerY = emblemWidth / 2;
    const originX = 0;
    const originY = 0;
    const absoluteLeft = emblemLayout.centerX - emblemWidth / 2;
    const absoluteTop = emblemLayout.centerY - emblemWidth / 2;
    const pointerX = pointer.x - absoluteLeft;
    const pointerY = pointer.y - absoluteTop;
    const rawAssembly = reducedMotion.matches
      ? 1
      : Math.max(0, Math.min(1, (time - assemblyStarted - 300) / 2500));
    const cubicAssembly = 1 - (1 - rawAssembly) ** 3;
    const assembly = cubicAssembly * cubicAssembly * (3 - 2 * cubicAssembly);
    const groupScale = 0.75 + assembly * 0.25;
    const lightX = originX + emblemWidth * 0.78 + (pointer.active ? (pointerX - centerX) * 0.13 : 0);
    const lightY = originY + emblemWidth * 0.24;
    const mouseRadius = emblemWidth * 0.42;

    emblemContext.clearRect(0, 0, emblemWidth, emblemWidth);

    if (rawAssembly <= 0) {
      return;
    }

    for (const point of emblemPoints) {
      const targetX = originX + (point.x + 0.5) * cell;
      const targetY = originY + (point.y + 0.5) * cell;
      const scatteredX = centerX + point.scatterX * emblemWidth * 0.34;
      const scatteredY = centerY + point.scatterY * emblemWidth * 0.34;
      let x = scatteredX + (targetX - scatteredX) * assembly;
      let y = scatteredY + (targetY - scatteredY) * assembly;

      x = centerX + (x - centerX) * groupScale;
      y = centerY + (y - centerY) * groupScale;

      const looseness = (0.25 + point.edge * 0.75) * assembly;
      x += Math.sin(time * 0.0005 + point.index * 0.53) * cell * 0.22 * looseness;
      y += Math.cos(time * 0.00042 + point.index * 0.71) * cell * 0.22 * looseness;

      const ear = Math.max(0, Math.min(1, (34 - point.y) / 24));
      y += Math.sin(time * 0.00115 + point.x * 0.092) * cell * 0.18 * ear * assembly;
      y += Math.sin(time * 0.0004) * cell * 0.34;

      const deltaX = x - pointerX;
      const deltaY = y - pointerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (pointer.active && assembly > 0.8 && distance < mouseRadius && distance > 0.1) {
        const falloff = (1 - distance / mouseRadius) ** 3;
        const distortion = Math.sin(point.index * 0.37 + time * 0.0005) * 0.95;
        const cosine = Math.cos(distortion);
        const sine = Math.sin(distortion);
        const directionX = deltaX / distance;
        const directionY = deltaY / distance;
        const force = falloff * ((assembly - 0.8) / 0.2) * cell * 5.8;

        x += (directionX * cosine - directionY * sine) * force;
        y += (directionX * sine + directionY * cosine) * force;
      }

      const distanceToLight = Math.hypot(x - lightX, y - lightY);
      const lit = Math.max(0, 1 - distanceToLight / (emblemWidth * 0.93));
      const shade = 0.5 + lit * lit * 0.72;
      const shimmer = 0.9 + Math.sin(time * 0.0015 + point.x * 0.9 + point.y * 0.54) * 0.1;
      const opacity =
        point.opacity *
        (0.61 + assembly * 0.3) *
        shimmer *
        Math.min(shade, 1) *
        (dark ? 1 : 0.86) *
        (compact ? 0.92 : 1) *
        (point.fill ? 0.82 : 1);
      const side = Math.max(
        point.fill ? 0.54 : 0.8,
        cell * 0.31 * point.size * (1 + audioLevel * 0.22),
      );
      const fold = point.x / 60;
      const red = point.accent
        ? 232
        : point.fill
          ? dark
            ? 151
            : 72
        : dark
          ? Math.min(255, Math.round(195 + Math.min(1, shade) * 50 + fold * 8))
          : Math.round(62 + Math.min(1, shade) * 36 + fold * 25);
      const green = point.accent
        ? 144
        : point.fill
          ? dark
            ? 211
            : 149
        : dark
          ? Math.min(255, Math.round(207 + Math.min(1, shade) * 40))
          : Math.round(92 + Math.min(1, shade) * 45);
      const blue = point.accent
        ? 178
        : point.fill
          ? dark
            ? 248
            : 219
        : dark
          ? Math.min(255, Math.round(220 + Math.min(1, shade) * 32))
          : Math.round(142 + Math.min(1, shade) * 57);

      emblemContext.fillStyle = `rgba(${red}, ${green}, ${blue}, ${opacity})`;
      emblemContext.fillRect(x - side / 2, y - side / 2, side, side);
    }
  };

  const draw = (time = performance.now()) => {
    context.clearRect(0, 0, width, height);

    const dark = document.documentElement.classList.contains("dark");

    drawEmblem(time, dark);

    for (const current of particles) {
      const x = current.u * width;
      const y = current.v * height;
      const seconds = (reducedMotion.matches ? 0 : time * 0.001) + current.phase;
      const cycle = Math.floor(seconds / current.period);
      const localTime = seconds % current.period;
      const onset = pixelNoise(current.seed + cycle * 17) * (current.period - current.duration);
      const progress = (localTime - onset) / current.duration;
      const sparkle = progress > 0 && progress < 1 ? Math.sin(progress * Math.PI) ** 3 : 0;
      const base = 0.12 + current.depth * 0.18;
      const opacity = Math.min(1, base + sparkle * (current.glow ? 0.8 : 0.48));

      if (dark && current.glow && sparkle > 0.12) {
        drawGlow(x, y, current.radius * 0.9, current.tone, sparkle * 0.35);
        const ray = current.radius * (1.8 + sparkle * 2.7);
        context.strokeStyle = `rgba(199, 224, 250, ${sparkle * 0.42})`;
        context.lineWidth = 0.55;
        context.beginPath();
        context.moveTo(x - ray, y);
        context.lineTo(x + ray, y);
        context.moveTo(x, y - ray);
        context.lineTo(x, y + ray);
        context.stroke();
      }

      context.fillStyle = `rgba(${dark ? particlePalette[current.tone] : "56, 103, 146"}, ${opacity * (dark ? 1 : 0.58)})`;
      context.beginPath();
      context.arc(x, y, current.radius, 0, Math.PI * 2);
      context.fill();
    }

  };

  const animate = (time) => {
    if (document.hidden || reducedMotion.matches) {
      frame = 0;
      return;
    }

    if (time - lastStarFrame >= 1000 / 30) {
      draw(time);
      lastStarFrame = time;
    }
    frame = window.requestAnimationFrame(animate);
  };

  const resume = () => {
    if (document.hidden || reducedMotion.matches) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      if (!document.hidden) draw();
      return;
    }
    if (!frame && !document.hidden && !reducedMotion.matches) {
      frame = window.requestAnimationFrame(animate);
    }
  };

  resize();
  draw();
  resume();

  if (showcase) {
    const emblemImage = new Image();
    emblemImage.decoding = "async";
    emblemImage.addEventListener("load", () => {
      const mask = document.createElement("canvas");
      mask.width = 60;
      mask.height = 60;

      const maskContext = mask.getContext("2d", { willReadFrequently: true });

      if (!maskContext) {
        return;
      }

      maskContext.fillStyle = "#fff";
      maskContext.fillRect(0, 0, mask.width, mask.height);

      const imageScale = Math.min(mask.width / emblemImage.width, mask.height / emblemImage.height);
      const imageWidth = emblemImage.width * imageScale;
      const imageHeight = emblemImage.height * imageScale;
      maskContext.drawImage(
        emblemImage,
        (mask.width - imageWidth) / 2,
        (mask.height - imageHeight) / 2,
        imageWidth,
        imageHeight,
      );

      const data = maskContext.getImageData(0, 0, mask.width, mask.height).data;
      const brightness = new Float32Array(mask.width * mask.height);

      for (let index = 0; index < brightness.length; index += 1) {
        const offset = index * 4;
        brightness[index] =
          1 -
          (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) / 255;
      }

      const rowBounds = Array.from({ length: mask.height }, (_, y) => {
        let start = mask.width;
        let end = -1;

        for (let x = 0; x < mask.width; x += 1) {
          if (brightness[y * mask.width + x] > 0.18) {
            start = Math.min(start, x);
            end = Math.max(end, x);
          }
        }

        return end - start >= 13 ? { start: start + 2, end: end - 2 } : null;
      });

      const isolated = (x, y) => {
        for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
          for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const sampleX = x + offsetX;
            const sampleY = y + offsetY;

            if (
              sampleX >= 0 &&
              sampleY >= 0 &&
              sampleX < mask.width &&
              sampleY < mask.height &&
              brightness[sampleY * mask.width + sampleX] > 0.2
            ) {
              return false;
            }
          }
        }

        return true;
      };

      let fillPointCount = 0;

      for (let y = 0; y < mask.height; y += 1) {
        for (let x = 0; x < mask.width; x += 1) {
          const value = brightness[y * mask.width + x];
          const bounds = rowBounds[y];
          const fillPoint =
            value <= 0.2 &&
            bounds &&
            x >= bounds.start &&
            x <= bounds.end &&
            (x * 3 + y * 5) % 7 === 0;

          if (
            (!fillPoint && value <= 0.2) ||
            (!fillPoint && isolated(x, y)) ||
            (!fillPoint && (x + y) % 2 !== 0)
          ) {
            continue;
          }

          let exposed = 0;

          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
              if (offsetX === 0 && offsetY === 0) {
                continue;
              }

              const sampleX = x + offsetX;
              const sampleY = y + offsetY;

              if (
                sampleX < 0 ||
                sampleY < 0 ||
                sampleX >= mask.width ||
                sampleY >= mask.height ||
                brightness[sampleY * mask.width + sampleX] <= 0.2
              ) {
                exposed += 1;
              }
            }
          }

          const angle = Math.random() * Math.PI * 2;
          const inclination = Math.acos(2 * Math.random() - 1);
          const radius = 0.4 + Math.random() * 0.6;
          const sourceOffset = (y * mask.width + x) * 4;

          emblemPoints.push({
            x,
            y,
            index: emblemPoints.length,
            opacity: fillPoint ? 0.42 + Math.random() * 0.2 : Math.min(1, value * 1.9),
            size: fillPoint ? 0.42 + Math.random() * 0.46 : 0.5 + Math.random(),
            edge: fillPoint ? 0.08 : exposed / 8,
            fill: Boolean(fillPoint),
            scatterX: Math.sin(inclination) * Math.cos(angle) * radius,
            scatterY: Math.sin(inclination) * Math.sin(angle) * radius,
            accent:
              data[sourceOffset] > data[sourceOffset + 1] * 1.17 &&
              data[sourceOffset] > data[sourceOffset + 2] * 1.04,
          });

          if (fillPoint) {
            fillPointCount += 1;
          }
        }
      }

      assemblyStarted = performance.now();
      canvas.dataset.emblem = "filled-particle-puppy";
      canvas.dataset.emblemPoints = String(emblemPoints.length);
      canvas.dataset.emblemFillPoints = String(fillPointCount);
      canvas.dataset.emblemSource = "user-provided-reference";
      canvas.dataset.sampling = "60x60-outline-and-silhouette-fill";

      if (emblemCanvas) {
        emblemCanvas.dataset.points = String(emblemPoints.length);
        emblemCanvas.dataset.fillPoints = String(fillPointCount);
        emblemCanvas.dataset.source = "user-provided-reference";
      }

      draw();
    });
    emblemImage.src = "/img/aurora/line-puppy.svg";
  }

  window.addEventListener("resize", resize, { passive: true });

  for (const button of document.querySelectorAll("#switch-layout-button")) {
    button.addEventListener("click", () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resize);
      });
    });
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") {
        return;
      }

      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => {
    pointer.active = false;
  });
  document.addEventListener("visibilitychange", resume);
  reducedMotion.addEventListener("change", resume);
  new MutationObserver(() => { if (reducedMotion.matches) draw(); }).observe(
    document.documentElement, { attributes: true, attributeFilter: ["class"] },
  );

  if (showcase) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
    const dock = document.createElement("div");
    dock.className = "yc-audio-dock";

    const player = document.createElement("button");
    player.type = "button";
    player.className = "yc-audio-visualizer";
    player.dataset.audioState = "paused";
    player.dataset.displayCapture = String(
      typeof navigator.mediaDevices?.getDisplayMedia === "function",
    );
    player.dataset.microphoneCapture = String(
      typeof navigator.mediaDevices?.getUserMedia === "function",
    );
    player.setAttribute("aria-pressed", "false");
    player.setAttribute("aria-expanded", "false");
    player.setAttribute("aria-haspopup", "menu");
    player.setAttribute(
      "aria-label",
      chinese ? "选择实时音频来源" : "Choose a live audio source",
    );
    player.innerHTML =
      '<span class="yc-audio-toggle" aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M7 4.8v10.4a.7.7 0 0 0 1.08.59l7.38-5.2a.72.72 0 0 0 0-1.18l-7.38-5.2A.7.7 0 0 0 7 4.8Z"/></svg></span>' +
      '<canvas class="yc-audio-spectrum" width="84" height="24" aria-hidden="true"></canvas>' +
      `<span class="yc-audio-label">${chinese ? "聆听" : "Listen"}</span>`;

    let audioSensitivity = 1;

    try {
      const savedSensitivity = Number(window.localStorage.getItem("yc-audio-sensitivity"));

      if (Number.isFinite(savedSensitivity) && savedSensitivity >= 0.55) {
        audioSensitivity = Math.min(1, savedSensitivity);
      }
    } catch {
      // A private browsing context may prevent saving this preference.
    }

    const chooser = document.createElement("div");
    chooser.className = "yc-audio-source-menu";
    chooser.hidden = true;
    chooser.setAttribute("role", "menu");
    chooser.innerHTML =
      `<p class="yc-audio-menu-title">${chinese ? "选择声音来源" : "Choose audio source"}</p>` +
      `<button class="yc-audio-source" type="button" role="menuitem" data-source="display"><span class="yc-audio-source-icon" aria-hidden="true">♫</span><span><strong>${chinese ? "电脑 / 标签页音乐" : "Computer / browser tab"}</strong><small>${chinese ? "分享播放音乐的标签页，并勾选共享音频" : "Share a music tab and enable audio sharing"}</small></span></button>` +
      `<button class="yc-audio-source" type="button" role="menuitem" data-source="microphone"><span class="yc-audio-source-icon" aria-hidden="true">◉</span><span><strong>${chinese ? "麦克风 / 外放音乐" : "Microphone / speakers"}</strong><small>${chinese ? "监听房间里播放的音乐或其他声音" : "Listen to nearby music or other sounds"}</small></span></button>` +
      '<div class="yc-audio-sensitivity">' +
      `<div class="yc-audio-sensitivity-heading"><span>${chinese ? "可视化灵敏度" : "Visualizer sensitivity"}</span><output class="yc-audio-sensitivity-value">${Math.round(audioSensitivity * 100)}%</output></div>` +
      '<div class="yc-audio-slider-wrapper">' +
      '<svg class="yc-audio-slider-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 8h2.4L10 5.2v9.6L6.4 12H4V8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>' +
      `<input class="yc-audio-slider" type="range" min="0.55" max="1" step="0.05" value="${audioSensitivity}" aria-label="${chinese ? "调整声音可视化灵敏度" : "Adjust audio visualization sensitivity"}">` +
      '<svg class="yc-audio-slider-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 8h2.4L9 5.2v9.6L5.4 12H3V8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 7.1c1.5 1.6 1.5 4.2 0 5.8M14.4 4.9c2.8 2.8 2.8 7.4 0 10.2" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>' +
      '</div></div>' +
      '<p class="yc-audio-status" role="status" aria-live="polite"></p>';

    dock.append(chooser, player);
    body.append(dock);
    window.requestAnimationFrame(resize);

    const spectrum = player.querySelector("canvas");
    const spectrumContext = spectrum.getContext("2d");

    if (!spectrumContext) {
      dock.remove();
      return;
    }

    const spectrumWidth = 84;
    const spectrumHeight = 24;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    spectrum.width = spectrumWidth * ratio;
    spectrum.height = spectrumHeight * ratio;
    spectrumContext.setTransform(ratio, 0, 0, ratio, 0, 0);

    const colors = spectrumContext.createLinearGradient(0, 0, spectrumWidth, 0);
    colors.addColorStop(0, "#9ce9d5");
    colors.addColorStop(0.52, "#adb9ff");
    colors.addColorStop(1, "#e1b8f2");

    let audioContext = null;
    let analyser = null;
    let frequencies = null;
    let mediaSource = null;
    let captureStream = null;
    let spectrumFrame = 0;
    let spectrumTick = 0;
    let playing = false;

    const drawSpectrum = () => {
      spectrumContext.clearRect(0, 0, spectrumWidth, spectrumHeight);

      if (playing && analyser && frequencies) {
        analyser.getByteFrequencyData(frequencies);

        let total = 0;

        for (let index = 0; index < 14; index += 1) {
          total += frequencies[index];
        }

        const sensedLevel = Math.min(1, (total / (14 * 255)) * audioSensitivity);
        audioLevel += (sensedLevel - audioLevel) * 0.16;

        if (spectrumTick % 12 === 0) {
          player.dataset.energy = String(Math.round(audioLevel * 100));
        }

        if (spectrumTick % 4 === 0) {
          player.style.setProperty("--yc-specular-energy", String(Math.min(audioLevel * 1.9, 1)));
        }

        spectrumTick += 1;
      }

      const count = 18;
      const gap = 1.6;
      const barWidth = (spectrumWidth - gap * (count - 1)) / count;

      for (let index = 0; index < count; index += 1) {
        const distanceFromCenter = Math.abs(index - (count - 1) / 2);
        const bucket = Math.min(12, 1 + Math.floor(distanceFromCenter * 0.84));
        const measured = playing && frequencies
          ? Math.min(1, (frequencies[bucket] / 255) * audioSensitivity)
          : 0;
        const idle = 0.07 + (1 - distanceFromCenter / (count / 2)) * 0.1;
        const strength = playing ? Math.max(idle, measured * (0.7 + audioLevel * 0.5)) : idle;
        const barHeight = Math.max(2.5, Math.min(spectrumHeight - 2, strength * 20));
        const x = index * (barWidth + gap);
        const y = (spectrumHeight - barHeight) / 2;

        spectrumContext.fillStyle = colors;
        spectrumContext.globalAlpha = playing ? 0.92 : 0.52;
        spectrumContext.beginPath();

        if (typeof spectrumContext.roundRect === "function") {
          spectrumContext.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        } else {
          spectrumContext.rect(x, y, barWidth, barHeight);
        }

        spectrumContext.fill();
      }

      spectrumContext.globalAlpha = 1;

      if (playing && !reducedMotion.matches) {
        spectrumFrame = window.requestAnimationFrame(drawSpectrum);
      }
    };

    const label = player.querySelector(".yc-audio-label");
    const status = chooser.querySelector(".yc-audio-status");
    const sensitivityInput = chooser.querySelector(".yc-audio-slider");
    const sensitivityValue = chooser.querySelector(".yc-audio-sensitivity-value");
    const playIcon =
      "M7 4.8v10.4a.7.7 0 0 0 1.08.59l7.38-5.2a.72.72 0 0 0 0-1.18l-7.38-5.2A.7.7 0 0 0 7 4.8Z";
    const stopIcon = "M6.2 4.6h2.7v10.8H6.2zm4.9 0h2.7v10.8h-2.7z";

    const syncSensitivity = () => {
      audioSensitivity = Math.max(0.55, Math.min(1, Number(sensitivityInput.value) || 1));
      const minimum = Number(sensitivityInput.min);
      const maximum = Number(sensitivityInput.max);
      const progress = ((audioSensitivity - minimum) / (maximum - minimum)) * 100;
      sensitivityInput.style.setProperty("--yc-slider-progress", `${progress}%`);
      sensitivityValue.textContent = `${Math.round(audioSensitivity * 100)}%`;
      player.dataset.sensitivity = audioSensitivity.toFixed(2);

      try {
        window.localStorage.setItem("yc-audio-sensitivity", String(audioSensitivity));
      } catch {
        // Keep the control functional even if the preference cannot be stored.
      }
    };

    sensitivityInput.addEventListener("input", syncSensitivity);
    syncSensitivity();

    const showMenu = (visible) => {
      chooser.hidden = !visible;
      player.setAttribute("aria-expanded", String(visible));

      if (visible) {
        status.textContent = "";
      }
    };

    const stopListening = () => {
      playing = false;
      audioLevel = 0;
      player.dataset.audioState = "paused";
      player.dataset.source = "";
      player.dataset.energy = "0";
      player.style.setProperty("--yc-specular-energy", "0");
      player.setAttribute("aria-pressed", "false");
      player.setAttribute("aria-label", chinese ? "选择实时音频来源" : "Choose a live audio source");
      player.querySelector(".yc-audio-toggle path").setAttribute("d", playIcon);
      label.textContent = chinese ? "聆听" : "Listen";
      window.cancelAnimationFrame(spectrumFrame);

      if (mediaSource) {
        mediaSource.disconnect();
        mediaSource = null;
      }

      if (captureStream) {
        for (const track of captureStream.getTracks()) {
          track.stop();
        }

        captureStream = null;
      }

      if (audioContext?.state === "running") {
        audioContext.suspend();
      }

      drawSpectrum();
    };

    const startListening = async (source) => {
      const devices = navigator.mediaDevices;

      if (!devices) {
        throw new Error("media-unavailable");
      }

      player.dataset.audioState = "requesting";
      status.textContent = chinese ? "等待浏览器授权……" : "Waiting for browser permission…";

      const stream =
        source === "display"
          ? await devices.getDisplayMedia({
              video: true,
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                suppressLocalAudioPlayback: false,
              },
              systemAudio: "include",
              surfaceSwitching: "include",
            })
          : await devices.getUserMedia({
              video: false,
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
            });

      if (!stream.getAudioTracks().length) {
        for (const track of stream.getTracks()) {
          track.stop();
        }

        throw new Error("missing-shared-audio");
      }

      if (!audioContext) {
        audioContext = new AudioContextClass();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        analyser.minDecibels = -92;
        analyser.maxDecibels = -18;
        frequencies = new Uint8Array(analyser.frequencyBinCount);
        player.dataset.fftSize = String(analyser.fftSize);
      }

      try {
        await audioContext.resume();
        captureStream = stream;
        mediaSource = audioContext.createMediaStreamSource(stream);
        mediaSource.connect(analyser);

        for (const track of stream.getTracks()) {
          track.addEventListener("ended", stopListening, { once: true });
        }

        playing = true;
        player.dataset.audioState = "listening";
        player.dataset.source = source;
        player.setAttribute("aria-pressed", "true");
        player.setAttribute("aria-label", chinese ? "停止监听音频" : "Stop listening to audio");
        player.querySelector(".yc-audio-toggle path").setAttribute("d", stopIcon);
        label.textContent =
          source === "display" ? (chinese ? "音乐" : "Music") : chinese ? "麦克风" : "Mic";
        showMenu(false);
        drawSpectrum();
      } catch (error) {
        for (const track of stream.getTracks()) {
          track.stop();
        }

        throw error;
      }
    };

    for (const option of chooser.querySelectorAll("[data-source]")) {
      const source = option.dataset.source;
      const available =
        source === "display"
          ? player.dataset.displayCapture === "true"
          : player.dataset.microphoneCapture === "true";

      option.disabled = !available;

      option.addEventListener("click", async () => {
        try {
          await startListening(source);
        } catch (error) {
          player.dataset.audioState = "paused";

          if (error?.message === "missing-shared-audio") {
            status.textContent = chinese
              ? "未捕获声音，请选择音乐标签页并勾选“共享标签页音频”。"
              : "No audio received. Choose a music tab and enable Share tab audio.";
          } else if (error?.name === "NotAllowedError") {
            status.textContent = chinese
              ? "没有授权；你也可以改用麦克风模式。"
              : "Permission declined. You can also choose microphone mode.";
          } else {
            status.textContent = chinese
              ? "当前浏览器不支持此来源，请尝试另一种方式。"
              : "This source is unavailable in the current browser. Try the other option.";
          }
        }
      });
    }

    player.addEventListener("click", () => {
      if (playing) {
        stopListening();
      } else {
        showMenu(chooser.hidden);
      }
    });

    document.addEventListener("click", (event) => {
      if (!dock.contains(event.target)) {
        showMenu(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !chooser.hidden) {
        showMenu(false);
        player.focus();
      }
    });

    drawSpectrum();
  }
})();
