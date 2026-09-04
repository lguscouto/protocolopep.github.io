/**
 * Seletor visual de locais de aplicação.
 *
 * O mapa é apenas uma representação do histórico configurado pelo usuário.
 * Ele não avalia a pele, não determina segurança e não recomenda onde aplicar.
 */

import torsoImageUrl from "../assets/injection-site-torso.png";

const VISUAL_POSITIONS = Object.freeze({
  "abdomen (superior direito)": Object.freeze({ placement: "abdomen-upper-right", order: 0 }),
  "abdomen (superior esquerdo)": Object.freeze({ placement: "abdomen-upper-left", order: 1 }),
  "abdomen (inferior direito)": Object.freeze({ placement: "abdomen-lower-right", order: 2 }),
  "abdomen (inferior esquerdo)": Object.freeze({ placement: "abdomen-lower-left", order: 3 }),
  "flanco (direito)": Object.freeze({ placement: "flank-right", order: 4 }),
  "flanco (esquerdo)": Object.freeze({ placement: "flank-left", order: 5 }),
  "abdomen (direito)": Object.freeze({ placement: "abdomen-right", order: 6 }),
  "abdomen (esquerdo)": Object.freeze({ placement: "abdomen-left", order: 7 })
});

const MODERN_RIGHT_ABDOMEN_KEYS = Object.freeze([
  "abdomen (superior direito)",
  "abdomen (inferior direito)"
]);
const MODERN_LEFT_ABDOMEN_KEYS = Object.freeze([
  "abdomen (superior esquerdo)",
  "abdomen (inferior esquerdo)"
]);

function normalizeSiteName(value) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getVisualSitePlacement(siteName) {
  return VISUAL_POSITIONS[normalizeSiteName(siteName)]?.placement || null;
}

export function createInjectionSitePickerModel(
  sites,
  { selectedSite = "", nextSite = "", lastSite = "" } = {}
) {
  if (!Array.isArray(sites)) return [];

  const selectedKey = normalizeSiteName(selectedSite);
  const nextKey = normalizeSiteName(nextSite);
  const lastKey = normalizeSiteName(lastSite);
  const configuredKeys = new Set(sites.map(normalizeSiteName));
  const hasModernRightAbdomen = MODERN_RIGHT_ABDOMEN_KEYS.some((key) => configuredKeys.has(key));
  const hasModernLeftAbdomen = MODERN_LEFT_ABDOMEN_KEYS.some((key) => configuredKeys.has(key));

  return sites
    .filter((site) => typeof site === "string" && site.trim())
    .map((site, index) => {
      const label = site.trim();
      const key = normalizeSiteName(label);
      const hideLegacyPlacement = (key === "abdomen (direito)" && hasModernRightAbdomen)
        || (key === "abdomen (esquerdo)" && hasModernLeftAbdomen);
      const visualConfig = hideLegacyPlacement ? null : (VISUAL_POSITIONS[key] || null);
      return {
        label,
        index,
        placement: visualConfig?.placement || null,
        visualOrder: visualConfig?.order ?? Number.MAX_SAFE_INTEGER,
        markerNumber: visualConfig && visualConfig.order < 6 ? visualConfig.order + 1 : null,
        selected: key === selectedKey,
        next: key === nextKey,
        last: key === lastKey
      };
    });
}

function createTorsoIllustration() {
  const image = document.createElement("img");
  image.className = "injection-site-figure";
  image.src = torsoImageUrl;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.setAttribute("draggable", "false");
  return image;
}

function createStatusLine(className, label, value) {
  const line = document.createElement("p");
  line.className = `injection-site-status ${className}`;

  const marker = document.createElement("span");
  marker.className = "injection-site-status-marker";
  marker.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.append(`${label}: `);
  const strong = document.createElement("strong");
  strong.textContent = value;
  text.appendChild(strong);

  line.append(marker, text);
  return line;
}

function createSiteButton(item, onSelect, { compact = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact ? "injection-site-chip" : "injection-site-point";
  if (item.placement) button.classList.add(item.placement);
  if (item.selected) button.classList.add("is-selected");
  if (item.next) button.classList.add("is-next");
  if (item.last) button.classList.add("is-last");
  button.setAttribute("aria-pressed", item.selected ? "true" : "false");
  button.setAttribute("aria-label", `Selecionar ${item.label}`);
  button.dataset.site = item.label;

  if (compact) {
    button.textContent = item.label;
  } else {
    const dot = document.createElement("span");
    dot.className = "injection-site-point-dot";
    dot.setAttribute("aria-hidden", "true");
    button.appendChild(dot);
    if (item.markerNumber) {
      const number = document.createElement("span");
      number.className = "injection-site-point-number";
      number.setAttribute("aria-hidden", "true");
      number.textContent = String(item.markerNumber);
      button.appendChild(number);
    }
  }

  button.addEventListener("click", () => onSelect(item.label));
  return button;
}

export function renderInjectionSitePicker({
  container,
  select,
  sites,
  selectedSite = "",
  nextSite = "",
  lastSite = ""
}) {
  if (!container || !select) return;

  const model = createInjectionSitePickerModel(sites, {
    selectedSite,
    nextSite,
    lastSite
  });

  const selectSite = (siteName) => {
    select.value = siteName;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    renderInjectionSitePicker({
      container,
      select,
      sites,
      selectedSite: siteName,
      nextSite,
      lastSite
    });
    const selectedButton = [...container.querySelectorAll("[data-site]")]
      .find((button) => button.dataset.site === siteName);
    selectedButton?.focus({ preventScroll: true });
  };

  const fragment = document.createDocumentFragment();

  const status = document.createElement("div");
  status.className = "injection-site-status-list";
  if (nextSite) {
    status.appendChild(createStatusLine("is-next", "Próximo na sua rotação", nextSite));
  }
  if (lastSite) {
    status.appendChild(createStatusLine("is-last", "Último registrado", lastSite));
  }
  if (status.childElementCount > 0) fragment.appendChild(status);

  const visualItems = model
    .filter((item) => item.placement)
    .sort((a, b) => a.visualOrder - b.visualOrder);

  if (visualItems.length > 0) {
    const map = document.createElement("div");
    map.className = "injection-site-map";
    map.setAttribute("role", "group");
    map.setAttribute("aria-label", "Locais do abdômen e flancos");
    map.appendChild(createTorsoIllustration());
    visualItems.forEach((item) => map.appendChild(createSiteButton(item, selectSite)));

    const mapLabel = document.createElement("div");
    mapLabel.className = "injection-site-map-label";
    const selectedVisualItem = visualItems.find((item) => item.selected);
    mapLabel.textContent = selectedVisualItem
      ? `Selecionado: ${selectedVisualItem.label}`
      : "Toque em um ponto do abdômen ou flanco";
    map.appendChild(mapLabel);
    fragment.appendChild(map);
  }

  const remainingItems = model.filter((item) => !item.placement);
  if (remainingItems.length > 0) {
    const alternatives = document.createElement("div");
    alternatives.className = "injection-site-alternatives";

    const alternativesLabel = document.createElement("div");
    alternativesLabel.className = "injection-site-alternatives-label";
    alternativesLabel.textContent = visualItems.length > 0 ? "Outros locais configurados" : "Locais configurados";
    alternatives.appendChild(alternativesLabel);

    const chips = document.createElement("div");
    chips.className = "injection-site-chips";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", alternativesLabel.textContent);
    remainingItems.forEach((item) => chips.appendChild(createSiteButton(item, selectSite, { compact: true })));
    alternatives.appendChild(chips);
    fragment.appendChild(alternatives);
  }

  const noSiteButton = document.createElement("button");
  noSiteButton.type = "button";
  noSiteButton.className = "injection-site-none";
  noSiteButton.dataset.site = "";
  if (!selectedSite) noSiteButton.classList.add("is-selected");
  noSiteButton.setAttribute("aria-pressed", selectedSite ? "false" : "true");
  noSiteButton.textContent = "Não especificar local";
  noSiteButton.addEventListener("click", () => selectSite(""));
  fragment.appendChild(noSiteButton);

  const disclaimer = document.createElement("p");
  disclaimer.className = "injection-site-disclaimer";
  disclaimer.textContent = "O mapa apenas registra sua escolha. Ele não avalia a pele nem indica onde aplicar.";
  fragment.appendChild(disclaimer);

  container.replaceChildren(fragment);
}
