// Behaviour for the static-page header (markup from scripts/site-header.mjs), matching the
// homepage header: hover or click opens Tools; Esc closes a menu and returns focus to its button;
// tabbing out of Tools closes it; the phone menu moves focus inside and makes the page inert.
(() => {
  const header = document.querySelector("[data-site-header]");
  if (!header) return;

  const tools = header.querySelector("[data-tools]");
  const toolsButton = tools.querySelector("button");
  const toolsPanel = document.getElementById(toolsButton.getAttribute("aria-controls"));
  const menuButton = header.querySelector(".hpe-menu-button");
  const sheet = document.getElementById(menuButton.getAttribute("aria-controls"));
  const behind = () => Array.from(document.querySelectorAll("body > main, body > footer"));
  let hoverTimer;

  const paint = () => {
    const open = toolsButton.getAttribute("aria-expanded") === "true" ||
      menuButton.getAttribute("aria-expanded") === "true";
    header.classList.toggle("is-open", open);
  };

  const setTools = (open) => {
    toolsButton.setAttribute("aria-expanded", String(open));
    toolsPanel.dataset.open = String(open);
    toolsPanel.inert = !open;
    paint();
  };

  const setSheet = (open) => {
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", menuButton.dataset[open ? "labelClose" : "labelOpen"]);
    sheet.dataset.open = String(open);
    sheet.inert = !open;
    behind().forEach((el) => (el.inert = open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) sheet.querySelector("a, button")?.focus();
    paint();
  };

  const isOpen = (button) => button.getAttribute("aria-expanded") === "true";

  toolsButton.addEventListener("click", () => setTools(!isOpen(toolsButton)));
  menuButton.addEventListener("click", () => setSheet(!isOpen(menuButton)));

  // Hover opens on devices with a mouse; the close delay lets the pointer cross to the panel.
  const hover = (open) => (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => setTools(open), open ? 60 : 160);
  };
  tools.addEventListener("pointerenter", hover(true));
  tools.addEventListener("pointerleave", hover(false));

  // Tabbing past the last tool closes the menu instead of leaving it over the page.
  tools.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !tools.contains(e.relatedTarget)) setTools(false);
  });

  document.addEventListener("pointerdown", (e) => {
    if (isOpen(toolsButton) && !tools.contains(e.target)) setTools(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isOpen(toolsButton)) {
      setTools(false);
      toolsButton.focus();
    }
    if (isOpen(menuButton)) {
      setSheet(false);
      menuButton.focus();
    }
  });

  // Picking a link inside a menu closes it (same-page anchors would otherwise leave it open).
  toolsPanel.addEventListener("click", (e) => e.target.closest("a") && setTools(false));
  sheet.addEventListener("click", (e) => e.target.closest("a") && setSheet(false));

  // Widening past the phone layout closes the phone menu so the page is not left inert.
  window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => {
    if (e.matches && isOpen(menuButton)) setSheet(false);
  });

  const onScroll = () => header.classList.toggle("is-raised", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();
