// Static-page site header: shadow once scrolled, and menus close on outside click or Escape.
const header = document.querySelector("[data-site-header]");

if (header) {
  const menus = header.querySelectorAll("details");
  const closeAll = (except) => {
    for (const menu of menus) if (menu !== except) menu.open = false;
  };

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  for (const menu of menus) {
    menu.addEventListener("toggle", () => {
      if (menu.open) closeAll(menu);
    });
  }
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) closeAll();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });
}
