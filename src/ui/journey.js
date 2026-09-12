export function normalizeTabTarget(target, currentSegment = "upcoming") {
  if (target === "week") return { tab: "journey", segment: "upcoming" };
  if (target === "history") return { tab: "journey", segment: "history" };
  return { tab: target, segment: target === "journey" ? currentSegment : null };
}

export function createJourney({ onNavigate }) {
  let segment = "upcoming";
  const buttons = Array.from(document.querySelectorAll("[data-journey-segment]"));
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => onNavigate(button.dataset.journeySegment === "history" ? "history" : "week"));
    button.addEventListener("keydown", (event) => {
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1
        : ["ArrowLeft", "ArrowRight"].includes(event.key) ? 1 - index : null;
      if (next === null) return;
      event.preventDefault();
      buttons[next].focus();
      buttons[next].click();
    });
  });
  return {
    get segment() { return segment; },
    activate(value) {
      segment = value === "history" ? "history" : "upcoming";
      buttons.forEach((button) => {
        const active = button.dataset.journeySegment === segment;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      for (const [id, name] of [["view-week", "upcoming"], ["view-history", "history"]]) {
        const panel = document.getElementById(id);
        panel.hidden = name !== segment;
        panel.classList.toggle("on", name === segment);
      }
    }
  };
}
