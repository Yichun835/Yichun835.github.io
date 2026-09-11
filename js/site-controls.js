/* Small native controls: appearance disclosure and copy-with-feedback. */
(() => {
  "use strict";
  const body = document.body;
  if (!body || body.dataset.siteControls) return;
  body.dataset.siteControls = "ready";
  const chinese = document.documentElement.lang.toLowerCase().startsWith("zh");
  const controls = [];
  const sliders = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h7m4 0h5M4 17h3m4 0h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="13" cy="7" r="2" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="17" r="2" stroke="currentColor" stroke-width="1.5"/></svg>';
  const layoutIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M10 4v16M10 10h10" stroke="currentColor" stroke-width="1.5"/></svg>';
  const closeAll = (restoreFocus = false) => {
    for (const control of controls) {
      if (control.panel.hidden) continue;
      control.panel.hidden = true;
      control.toggle.setAttribute("aria-expanded", "false");
      if (restoreFocus) control.toggle.focus();
    }
  };
  for (const theme of document.querySelectorAll("#appearance-switcher, #appearance-switcher-mobile")) {
    const wrapper = document.createElement("div");
    wrapper.className = "yc-appearance-control";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "yc-appearance-toggle";
    toggle.innerHTML = sliders;
    toggle.setAttribute("aria-label", chinese ? "外观设置" : "Appearance settings");
    toggle.title = chinese ? "外观设置" : "Appearance settings";
    toggle.setAttribute("aria-expanded", "false");
    const panel = document.createElement("div");
    panel.className = "yc-appearance-panel";
    panel.id = `yc-${theme.id}-panel`;
    panel.hidden = true;
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", chinese ? "外观" : "Appearance");
    toggle.setAttribute("aria-controls", panel.id);
    const heading = document.createElement("span");
    heading.className = "yc-appearance-heading";
    heading.textContent = chinese ? "外观" : "Appearance";
    const label = document.createElement("span");
    label.className = "yc-appearance-label";
    theme.classList.add("yc-appearance-action");
    theme.append(label);
    const updateLabel = () => {
      label.textContent = document.documentElement.classList.contains("dark")
        ? (chinese ? "切换到浅色" : "Light mode")
        : (chinese ? "切换到深色" : "Dark mode");
      theme.setAttribute("aria-label", label.textContent);
    };
    updateLabel();
    theme.before(wrapper);
    panel.append(heading, theme);
    wrapper.append(toggle, panel);
    const control = { wrapper, toggle, panel };
    controls.push(control);
    if (body.classList.contains("yc-home-page")) {
      const layout = document.createElement("button");
      layout.type = "button";
      layout.className = "yc-appearance-action yc-appearance-layout";
      layout.innerHTML = `${layoutIcon}<span>${chinese ? "切换布局" : "Switch layout"}</span>`;
      layout.addEventListener("click", () => {
        closeAll(true);
        // Delegate to the existing button: preserves PixelSwap and reduced motion.
        document.querySelector("#switch-layout-button")?.click();
      });
      panel.append(layout);
    }
    toggle.addEventListener("click", () => {
      const open = panel.hidden;
      closeAll();
      if (open) {
        window.dispatchEvent(new Event("yc:appearance-open"));
        panel.hidden = false; toggle.setAttribute("aria-expanded", "true");
      }
    });
    toggle.addEventListener("keydown", event => {
      if (event.key !== "ArrowDown") return;
      event.preventDefault(); closeAll();
      window.dispatchEvent(new Event("yc:appearance-open"));
      panel.hidden = false; toggle.setAttribute("aria-expanded", "true"); theme.focus();
    });
    wrapper.addEventListener("focusout", event => {
      if (event.relatedTarget && !wrapper.contains(event.relatedTarget)) closeAll();
    });
    // Preserve the original theme handler and circular theme transition.
    theme.addEventListener("click", () => closeAll(true));
    new MutationObserver(updateLabel).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  // Original buttons stay as fallback and retain their event handlers.
  if (controls.length) body.classList.add("yc-appearance-ready");
  addEventListener("yc:before-theme-change", () => closeAll(true));
  document.addEventListener("pointerdown", event => {
    if (!controls.some(({ wrapper }) => wrapper.contains(event.target))) closeAll();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && controls.some(({ panel }) => !panel.hidden)) {
      event.preventDefault(); closeAll(true);
    }
  });
  addEventListener("resize", () => closeAll());
  addEventListener("pagehide", () => closeAll());
  addEventListener("pageshow", () => closeAll());

  // Keep the native mailto action, but never leave an unsupported mail handler silent.
  function installMailFallback() {
    let panel;
    let trigger;
    const close = (restoreFocus = false) => {
      if (!panel || panel.hidden) return;
      panel.hidden = true;
      if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
    document.addEventListener("click", event => {
      const link = event.target.closest?.('a.yc-electric-contact, a.yc-contact-logoloop-link[href^="mailto:"]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const href = link.getAttribute("href") || "";
      if (!href.toLowerCase().startsWith("mailto:")) return;
      let address;
      try { address = decodeURIComponent(href.slice(7).split("?")[0]); } catch { return; }
      if (!address || /[\r\n]/.test(address)) return;
      trigger = link;
      if (!panel) {
        panel = document.createElement("section");
        panel.className = "yc-mail-help";
        panel.hidden = true;
        panel.setAttribute("aria-label", chinese ? "邮件联系方式" : "Email contact");
        panel.innerHTML = '<strong class="yc-mail-help-title">Email</strong>' +
          '<button type="button" class="yc-mail-help-close"></button>' +
          '<p class="yc-mail-help-note"></p><p class="yc-mail-help-address"></p>' +
          '<button type="button" class="yc-email-copy yc-mail-help-copy"></button>' +
          '<span class="yc-sr-only" role="status" aria-live="polite"></span>';
        const dismiss = panel.querySelector(".yc-mail-help-close");
        dismiss.textContent = "×";
        dismiss.setAttribute("aria-label", chinese ? "关闭邮箱提示" : "Close email help");
        dismiss.addEventListener("click", () => close(true));
        panel.querySelector(".yc-mail-help-note").textContent = chinese
          ? "如果邮件应用没有打开，可以复制邮箱地址后写信。"
          : "If your mail app doesn’t open, copy my email address to write to me.";
        const copy = panel.querySelector(".yc-mail-help-copy");
        copy.textContent = chinese ? "复制邮箱" : "Copy email";
        copy.setAttribute("aria-label", chinese ? "复制邮箱地址" : "Copy email address");
        document.body.append(panel);
      }
      panel.querySelector(".yc-mail-help-address").textContent = address;
      panel.querySelector(".yc-mail-help-copy").dataset.copyEmail = address;
      panel.hidden = false;
      panel.querySelector('[role="status"]').textContent = chinese
        ? "已请求打开邮件应用；如未打开，可复制邮箱地址。"
        : "Mail app requested. If it doesn’t open, you can copy the email address.";
      // Put the backup action within immediate keyboard reach; Escape returns to the link.
      if (event.detail === 0) panel.querySelector(".yc-mail-help-copy").focus({ preventScroll: true });
      // No preventDefault, popup, timer-based success claim or automatic clipboard write.
      // The original mailto continues synchronously within the user's click gesture.
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape" || event.defaultPrevented || !panel || panel.hidden) return;
      event.preventDefault(); close(true);
    });
    document.addEventListener("pointerdown", event => {
      if (panel && !panel.hidden && !panel.contains(event.target) && !trigger?.contains(event.target)) close();
    });
    addEventListener("pagehide", () => close());
  }
  installMailFallback();

  async function copyEmail(text) {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* Try the user-gesture fallback on restricted clipboard APIs. */ }
    const previous = document.activeElement;
    const field = document.createElement("textarea");
    field.value = text;
    field.readOnly = true;
    field.className = "yc-copy-fallback";
    field.setAttribute("aria-label", chinese ? "邮箱地址" : "Email address");
    document.body.append(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { /* Report failure honestly. */ }
    field.remove();
    previous?.focus({ preventScroll: true });
    return copied;
  }
  let resetFeedback = 0;
  document.addEventListener("click", async event => {
    const button = event.target.closest(".yc-email-copy");
    if (!button || button.dataset.busy) return;
    event.preventDefault();
    button.dataset.busy = "true";
    const copied = await copyEmail(button.dataset.copyEmail);
    delete button.dataset.busy;
    const label = copied ? (chinese ? "已复制" : "Copied") : (chinese ? "未复制" : "Retry");
    const status = button.closest(".yc-mail-help")?.querySelector('[role="status"]') || document.getElementById("yc-copy-status");
    if (status) status.textContent = copied
      ? (chinese ? "邮箱地址已复制" : "Email address copied")
      : (chinese ? "无法自动复制，请选择邮箱文字手动复制。" : "Could not copy. Select the email address to copy it manually.");
    clearTimeout(resetFeedback);
    const buttons = [...document.querySelectorAll(".yc-email-copy")];
    for (const copy of buttons) {
      copy.dataset.originalIcon ||= copy.innerHTML;
      copy.textContent = label;
      copy.dataset.state = copied ? "copied" : "error";
      copy.title = copied ? label : (status?.textContent || label);
    }
    // Mouse clicks must not leave the continuously scrolling loop paused.
    if (event.detail > 0) button.blur();
    resetFeedback = setTimeout(() => {
      for (const copy of buttons) {
        copy.innerHTML = copy.dataset.originalIcon;
        delete copy.dataset.state;
        copy.title = chinese ? "复制邮箱地址" : "Copy email address";
      }
      if (status) status.textContent = "";
    }, 1800);
  });
})();
