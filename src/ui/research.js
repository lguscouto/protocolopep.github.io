/**
 * Controlador de Interface — Base de Pesquisa Científica (V17)
 *
 * Princípios de Governança (AGENTS.md):
 * - Não Prescrição: Apresentação puramente educativa de dados farmacocinéticos da literatura.
 * - Local-First & Offline First: Busca 100% em memória no cliente.
 * - Resiliência e Sanitização: Prevenção contra injeção de HTML.
 */

import { escapeHtml, sanitizeColor, sanitizeId } from "./dom.js";
import { haptics } from "../services/haptics.js";
import { i18nService } from "../services/i18n.js";

const esc = escapeHtml;

export function setupResearchUI({
  researchService,
  onOpenCalculator = () => {},
  onAddToProtocol = () => {}
}) {
  const modal = document.getElementById("research-modal");
  const detailModal = document.getElementById("compound-detail-modal");
  const searchInput = document.getElementById("research-search-input");
  const clearBtn = document.getElementById("research-clear-btn");
  const chipsContainer = document.getElementById("research-category-chips");
  const resultsContainer = document.getElementById("research-results-list");
  const closeBtn = document.getElementById("research-modal-close");
  const detailCloseBtn = document.getElementById("compound-detail-close");

  let activeCategory = "all";
  let activeCompound = null;

  function renderCategoryChips() {
    if (!chipsContainer) return;
    chipsContainer.innerHTML = "";

    const categories = researchService.getCategories();
    const allChip = document.createElement("button");
    allChip.type = "button";
    allChip.className = `chip ${activeCategory === "all" ? "sel" : ""}`;
    allChip.style.cssText = "white-space:nowrap;flex-shrink:0;font-size:12px;padding:6px 12px;border-radius:16px;";
    allChip.textContent = i18nService.t("research.allCategories");
    allChip.setAttribute("data-cat", "all");
    allChip.addEventListener("click", () => {
      activeCategory = "all";
      haptics.selection();
      renderCategoryChips();
      renderResults();
    });
    chipsContainer.appendChild(allChip);

    categories.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `chip ${activeCategory === cat.id ? "sel" : ""}`;
      chip.style.cssText = "white-space:nowrap;flex-shrink:0;font-size:12px;padding:6px 12px;border-radius:16px;";
      chip.textContent = `${cat.label} (${cat.count})`;
      chip.setAttribute("data-cat", cat.id);
      chip.addEventListener("click", () => {
        activeCategory = cat.id;
        haptics.selection();
        renderCategoryChips();
        renderResults();
      });
      chipsContainer.appendChild(chip);
    });
  }

  function renderResults() {
    if (!resultsContainer) return;
    const query = searchInput ? searchInput.value : "";
    const compounds = researchService.search(query, activeCategory);

    resultsContainer.innerHTML = "";

    if (compounds.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state-illustrated empty-state-illustrated--research">
          <img class="empty-state-illustration" src="/assets/illustrations/empty-research.png" alt="" aria-hidden="true">
          <div class="empty-state-title">${esc(i18nService.t("research.emptyTitle"))}</div>
          <div class="empty-state-description">${esc(i18nService.t("research.emptyDesc"))}</div>
        </div>
      `;
      return;
    }

    compounds.forEach((c) => {
      const isFav = researchService.isFavorite(c.id);
      const card = document.createElement("div");
      card.className = "card research-card";
      card.style.setProperty("--acc", sanitizeColor(c.accentColor || "var(--primary)"));
      card.style.cursor = "pointer";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `${c.name} - ${c.categoryLabel}`);

      const synonymsHTML = Array.isArray(c.synonyms) && c.synonyms.length > 0
        ? `<div style="font-size:11.5px;color:var(--muted);margin-top:2px;">Sinônimos: ${esc(c.synonyms.slice(0, 3).join(", "))}</div>`
        : "";

      card.innerHTML = `
        <div class="info" style="flex:1;min-width:0;width:100%;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;">
            <div class="nm" style="color:var(--text);font-size:16px;font-weight:700;"><span class="dot"></span>${esc(c.name)}</div>
            <button type="button" class="icon-b fav-btn ${isFav ? "is-favorite" : ""}" data-id="${sanitizeId(c.id)}" title="${isFav ? 'Remover favorito' : 'Favoritar'}" aria-pressed="${isFav ? "true" : "false"}">
              <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
          <div class="sub" style="font-size:12px;color:var(--muted);margin-top:2px;">${esc(c.fullName || "")}</div>
          ${synonymsHTML}
          <div class="meta" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <span class="chip-acc">${esc(c.categoryLabel)}</span>
            <span class="freq" style="font-size:11.5px;color:var(--muted);">⏰ ${esc(c.halfLifeLiterature)}</span>
          </div>
          <div class="note-line" style="margin-top:8px;">
            <span class="note-txt" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;font-size:12px;color:var(--text);">
              ${esc(c.literatureSummary)}
            </span>
          </div>
        </div>
      `;

      // Clique no card abre modal de detalhes
      card.onclick = (e) => {
        e.stopPropagation();
        if (e.target.closest(".fav-btn")) return;
        haptics.selection();
        setTimeout(() => {
          openCompoundDetail(c);
        }, 50);
      };

      // Teclado (Enter / Espaço)
      card.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          openCompoundDetail(c);
        }
      };

      // Botão de Favorito
      const favBtn = card.querySelector(".fav-btn");
      if (favBtn) {
        favBtn.onclick = (e) => {
          e.stopPropagation();
          haptics.selection();
          researchService.toggleFavorite(c.id);
          renderResults();
        };
      }

      resultsContainer.appendChild(card);
    });
  }

  function openCompoundDetail(compound) {
    if (!compound || !detailModal) return;
    activeCompound = compound;

    const titleEl = document.getElementById("compound-detail-title");
    const fullEl = document.getElementById("compound-detail-fullname");
    const categoryEl = document.getElementById("compound-detail-category");
    const halfLifeEl = document.getElementById("compound-detail-halflife");
    const storageEl = document.getElementById("compound-detail-storage");
    const solventEl = document.getElementById("compound-detail-solvent");
    const mechanismEl = document.getElementById("compound-detail-mechanism");
    const safetyEl = document.getElementById("compound-detail-safety");
    const summaryEl = document.getElementById("compound-detail-summary");
    const refsContainer = document.getElementById("compound-detail-refs");
    const calcBtn = document.getElementById("compound-detail-calc-btn");
    const addProtoBtn = document.getElementById("compound-detail-protocol-btn");

    if (titleEl) titleEl.textContent = compound.name;
    if (fullEl) fullEl.textContent = compound.fullName || "";
    if (categoryEl) {
      categoryEl.textContent = compound.categoryLabel;
      categoryEl.style.color = sanitizeColor(compound.accentColor || "var(--primary)");
    }
    if (halfLifeEl) halfLifeEl.textContent = compound.halfLifeLiterature;
    if (storageEl) storageEl.textContent = compound.storageGuidelines;
    if (solventEl) solventEl.textContent = `${compound.suggestedSolvent} · ${compound.typicalReconstitution || ''}`;
    if (mechanismEl) mechanismEl.textContent = compound.mechanism;
    if (safetyEl) safetyEl.textContent = compound.safetyNotes || "Substância para pesquisa.";
    if (summaryEl) summaryEl.textContent = compound.literatureSummary;

    if (refsContainer) {
      refsContainer.innerHTML = "";
      if (Array.isArray(compound.references) && compound.references.length > 0) {
        compound.references.forEach((ref) => {
          const item = document.createElement("div");
          item.style.cssText = "padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;line-height:1.4;";
          
          let linkHTML = "";
          if (ref.pmid) {
            linkHTML = `<a href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(ref.pmid)}/" target="_blank" rel="noopener noreferrer" style="color:var(--primary);font-weight:600;display:inline-block;margin-top:2px;">PubMed: ${esc(ref.pmid)} ↗</a>`;
          }

          item.innerHTML = `
            <div style="font-weight:600;color:var(--text);">${esc(ref.title || '')}</div>
            <div style="color:var(--muted);">${esc(ref.authors || '')} — <em>${esc(ref.journal || '')}</em> (${esc(String(ref.year || ''))})</div>
            ${linkHTML}
          `;
          refsContainer.appendChild(item);
        });
      } else {
        refsContainer.innerHTML = `<div style="font-size:12px;color:var(--muted);">Nenhuma referência bibliográfica indexada.</div>`;
      }
    }

    if (calcBtn) {
      calcBtn.onclick = () => {
        closeDetailModal(false);
        closeMainModal();
        onOpenCalculator(compound);
      };
    }

    if (addProtoBtn) {
      addProtoBtn.onclick = () => {
        closeDetailModal(false);
        closeMainModal();
        onAddToProtocol(compound);
      };
    }

    if (modal) modal.classList.remove("on");
    detailModal.classList.add("on");
    detailModal.setAttribute("aria-hidden", "false");
  }

  function openMainModal() {
    if (!modal) return;
    modal.classList.add("on");
    modal.setAttribute("aria-hidden", "false");
    renderCategoryChips();
    renderResults();
    if (searchInput) {
      searchInput.value = "";
    }
  }

  function closeMainModal() {
    if (!modal) return;
    modal.classList.remove("on");
    modal.setAttribute("aria-hidden", "true");
  }

  function closeDetailModal(reopenMain = true) {
    if (!detailModal) return;
    detailModal.classList.remove("on");
    detailModal.setAttribute("aria-hidden", "true");
    activeCompound = null;
    if (reopenMain && modal) {
      modal.classList.add("on");
      modal.setAttribute("aria-hidden", "false");
    }
  }

  // Setup Listeners
  const researchSheet = modal ? modal.querySelector(".sheet") : null;
  if (researchSheet) {
    researchSheet.addEventListener("click", (e) => e.stopPropagation());
  }

  const detailSheet = detailModal ? detailModal.querySelector(".sheet") : null;
  if (detailSheet) {
    detailSheet.addEventListener("click", (e) => e.stopPropagation());
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      haptics.selection();
      closeMainModal();
    });
  }

  if (detailCloseBtn) {
    detailCloseBtn.addEventListener("click", () => {
      haptics.selection();
      closeDetailModal(true);
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const val = searchInput.value.trim();
      if (val.length >= 3) {
        researchService.addRecentQuery(val);
      }
      renderResults();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      renderResults();
    });
  }

  // Atalhos de abertura rápida nos painéis
  const openButtons = document.querySelectorAll(".open-research-modal-btn");
  openButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      haptics.selection();
      openMainModal();
    });
  });

  return {
    openModal: openMainModal,
    closeModal: closeMainModal,
    openCompoundDetail,
    renderResults
  };
}
