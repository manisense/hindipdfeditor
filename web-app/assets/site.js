const tabs = document.querySelectorAll("[data-tool-tab]");
const cards = document.querySelectorAll("[data-tool-category]");

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const filter = tab.getAttribute("data-tool-tab");

    for (const item of tabs) {
      item.classList.toggle("active", item === tab);
      item.setAttribute("aria-selected", item === tab ? "true" : "false");
    }

    for (const card of cards) {
      const categories = (card.getAttribute("data-tool-category") || "").split(
        " ",
      );
      card.hidden = filter !== "all" && !categories.includes(filter || "");
    }
  });
}
