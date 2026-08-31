/**
 * Módulo de Interface: Calculadora de Reconstituição e Dosagem (V13)
 *
 * Responsável por orquestrar os inputs de massa (mg), diluente (mL),
 * dose pretendida (mcg/mg), cálculo matemático puro (calculator domain),
 * conferência dos dados, renderização gráfica da seringa U-100 e
 * integração com a criação de protocolos e estoque.
 */

import { calculateReconstitution, convertDoseValue } from "../domain/calculator.js";
import { createCalculationSnapshot, formatAuditTrail } from "../domain/calculation-record.js";
import { escapeHtml } from "./dom.js";

/**
 * Inicializa a interface e ouvintes de eventos da Calculadora.
 *
 * @param {Object} options
 * @param {Object} options.haptics
 * @param {Function} [options.onUseCalculation]
 * @param {Function} [options.onSaveVial]
 * @returns {Object}
 */
export function setupCalculatorUI({
  haptics,
  onUseCalculation = () => {},
  onSaveVial = () => {}
} = {}) {
  let vialMg = 5;
  let diluentMl = 2;
  let desiredDoseVal = NaN;
  let doseUnit = "mcg";
  let currentCalculationSnapshot = null;

  const mgChips = document.querySelectorAll("#calc-mg-chips .chip");
  const mlChips = document.querySelectorAll("#calc-ml-chips .chip");
  const doseInput = document.getElementById("calc-dose-input");
  const unitBtns = document.querySelectorAll("#calc-unit-toggle button");
  const auditCard = document.getElementById("calc-audit-card");
  const auditFormula = document.getElementById("calc-audit-formula");
  const auditTrail = document.getElementById("calc-audit-trail");
  const useBtn = document.getElementById("calc-use-btn");
  const saveVialBtn = document.getElementById("calc-save-vial-btn");

  function recalculate() {
    const resBig = document.getElementById("calc-res-big");
    const resSub = document.getElementById("calc-res-sub");
    const resConc = document.getElementById("calc-res-conc");
    const resDoses = document.getElementById("calc-res-doses");
    const summaryCard = document.getElementById("calc-inputs-summary");
    const summaryValues = document.getElementById("calc-summary-values");

    const concentrationMgMl = diluentMl > 0 ? (vialMg / diluentMl).toFixed(2) : "0.00";
    if (resConc) resConc.textContent = `${concentrationMgMl} mg/mL`;

    if (isNaN(desiredDoseVal) || desiredDoseVal <= 0) {
      if (resBig) resBig.textContent = "--";
      if (resSub) resSub.innerHTML = `Informe a dose pretendida acima para calcular as unidades (UI).`;
      if (resDoses) resDoses.textContent = "--";
      if (auditCard) auditCard.style.display = "none";
      if (summaryCard) summaryCard.style.display = "none";
      if (useBtn) useBtn.disabled = true;
      if (saveVialBtn) saveVialBtn.disabled = true;
      currentCalculationSnapshot = null;
      renderSyringe(0);
      return;
    }

    const result = calculateReconstitution({
      vialMg,
      waterMl: diluentMl,
      doseVal: desiredDoseVal,
      doseUnit,
      syringeMaxUI: 100
    });

    if (!result.valid) {
      if (resBig) resBig.textContent = "--";
      if (resSub) resSub.innerHTML = `<span style="color:var(--danger)">⚠️ ${escapeHtml(result.error || "Dados de cálculo inválidos")}</span>`;
      if (resDoses) resDoses.textContent = "--";
      if (auditCard) auditCard.style.display = "none";
      if (summaryCard) summaryCard.style.display = "none";
      if (useBtn) useBtn.disabled = true;
      if (saveVialBtn) saveVialBtn.disabled = true;
      currentCalculationSnapshot = null;
      renderSyringe(0);
      return;
    }

    if (resBig) resBig.textContent = String(result.unitsUI);
    if (resSub) resSub.innerHTML = `Aspire até <b>${result.unitsUI} UI</b> na seringa de insulina U-100 (${result.volumeMl} mL)`;
    if (resDoses) resDoses.textContent = `${result.dosesPerVial} doses`;

    if (summaryCard && summaryValues) {
      summaryCard.style.display = "block";
      summaryValues.innerHTML = `
        <span><b>Frasco:</b> ${vialMg} mg</span>
        <span><b>Diluente:</b> ${diluentMl} mL</span>
        <span><b>Dose pretendida:</b> ${desiredDoseVal} ${doseUnit}</span>
      `;
    }

    currentCalculationSnapshot = createCalculationSnapshot(result);

    if (auditCard) {
      auditCard.style.display = "flex";
      if (auditFormula) auditFormula.textContent = result.formula;
      if (auditTrail) auditTrail.textContent = formatAuditTrail(currentCalculationSnapshot);
    }

    if (useBtn) useBtn.disabled = false;
    if (saveVialBtn) saveVialBtn.disabled = false;

    renderSyringe(result.unitsUI);
  }

  function renderSyringe(ui) {
    const cont = document.getElementById("calc-syringe");
    if (!cont) return;

    const clampedUi = Math.min(100, Math.max(0, ui));
    const fillWidth = (clampedUi / 100) * 240;

    cont.innerHTML = `
      <svg viewBox="0 0 320 60" style="width:100%;max-width:340px;height:auto;" aria-hidden="true">
        <rect x="30" y="15" width="250" height="30" rx="4" fill="var(--surface3)" stroke="var(--border2)" stroke-width="1.5"/>
        <rect x="30" y="16" width="${fillWidth}" height="28" fill="var(--primary)" opacity="0.6"/>
        <line x1="8" y1="30" x2="30" y2="30" stroke="var(--muted2)" stroke-width="2"/>
        ${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => {
          const x = 30 + (tick / 100) * 240;
          return `
            <line x1="${x}" y1="15" x2="${x}" y2="${tick % 20 === 0 ? "27" : "22"}" stroke="var(--text)" stroke-width="1" opacity="0.7"/>
            ${tick % 20 === 0 ? `<text x="${x}" y="38" font-size="8" font-family="var(--display)" fill="var(--muted)" text-anchor="middle">${tick}</text>` : ""}
          `;
        }).join("")}
        <line x1="${30 + fillWidth}" y1="10" x2="${30 + fillWidth}" y2="50" stroke="var(--danger)" stroke-width="3"/>
      </svg>`;
  }

  mgChips.forEach((c) => {
    c.addEventListener("click", () => {
      mgChips.forEach((x) => x.classList.remove("sel"));
      c.classList.add("sel");
      vialMg = Number(c.dataset.v) || 5;
      haptics?.light?.();
      recalculate();
    });
  });

  mlChips.forEach((c) => {
    c.addEventListener("click", () => {
      mlChips.forEach((x) => x.classList.remove("sel"));
      c.classList.add("sel");
      diluentMl = Number(c.dataset.v) || 2;
      haptics?.light?.();
      recalculate();
    });
  });

  if (doseInput) {
    doseInput.addEventListener("input", (e) => {
      const raw = e.target.value.trim();
      const val = parseFloat(raw);
      desiredDoseVal = raw !== "" && !isNaN(val) ? val : NaN;
      recalculate();
    });
  }

  unitBtns.forEach((b) => {
    b.addEventListener("click", () => {
      const oldUnit = doseUnit;
      const newUnit = b.dataset.u || "mcg";
      if (oldUnit === newUnit) return;

      unitBtns.forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      doseUnit = newUnit;

      if (doseInput && doseInput.value) {
        const converted = convertDoseValue(doseInput.value, oldUnit, newUnit);
        doseInput.value = converted;
        desiredDoseVal = parseFloat(converted) || 0;
      }

      if (doseInput) {
        doseInput.placeholder = doseUnit === "mcg" ? "ex: 250" : "ex: 2.5";
      }

      haptics?.light?.();
      recalculate();
    });
  });

  if (useBtn) {
    useBtn.addEventListener("click", () => {
      if (!currentCalculationSnapshot) return;
      haptics?.medium?.();
      onUseCalculation({
        dose: `${desiredDoseVal} ${doseUnit}`,
        ui: currentCalculationSnapshot.unitsUI,
        calculationSnapshot: currentCalculationSnapshot
      });
    });
  }

  if (saveVialBtn) {
    saveVialBtn.addEventListener("click", () => {
      if (!currentCalculationSnapshot) return;
      haptics?.medium?.();
      onSaveVial({
        vialMg,
        diluentMl,
        doseVal: desiredDoseVal,
        doseUnit,
        calculationSnapshot: currentCalculationSnapshot
      });
    });
  }

  recalculate();

  return {
    recalculate,
    setValues: ({ mg = null, ml = null, dose = null, unit = null } = {}) => {
      if (mg !== null) {
        vialMg = Number(mg) || vialMg;
        mgChips.forEach((x) => {
          x.classList.toggle("sel", Number(x.dataset.v) === vialMg);
        });
      }
      if (ml !== null) {
        diluentMl = Number(ml) || diluentMl;
        mlChips.forEach((x) => {
          x.classList.toggle("sel", Number(x.dataset.v) === diluentMl);
        });
      }
      if (unit !== null && (unit === "mcg" || unit === "mg")) {
        doseUnit = unit;
        unitBtns.forEach((x) => {
          x.classList.toggle("on", x.dataset.u === doseUnit);
        });
        if (doseInput) {
          doseInput.placeholder = doseUnit === "mcg" ? "ex: 250" : "ex: 2.5";
        }
      }
      if (dose !== null) {
        desiredDoseVal = typeof dose === "number" ? dose : (parseFloat(String(dose)) || NaN);
        if (doseInput) {
          doseInput.value = !isNaN(desiredDoseVal) ? String(desiredDoseVal) : "";
        }
      }
      recalculate();
    },
    getSnapshot: () => currentCalculationSnapshot
  };
}
