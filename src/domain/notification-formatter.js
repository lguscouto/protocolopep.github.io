/**
 * Domínio Puro de Formatação e Estado de Notificações (V05)
 */

export function formatNotificationContent(peptide = {}, options = {}) {
  const { discreteMode = true } = options;

  if (discreteMode) {
    return {
      title: "Protocolo PEP",
      body: "Horário de aplicação programada"
    };
  }

  const name = peptide.name || "Peptídeo";
  const dose = peptide.dose || "Dose programada";
  const ui = peptide.ui ? `${peptide.ui} UI · ` : "";
  const sub = peptide.sub ? ` (${peptide.sub})` : "";

  return {
    title: `Lembrete: ${name}`,
    body: `${ui}${dose}${sub}`
  };
}

export function getNotificationVisualState({
  enabled = false,
  permission = "prompt", // "granted" | "denied" | "prompt"
  exactAlarm = "granted", // "granted" | "denied" | "not_applicable" | "unknown"
  pendingCount = 0,
  horizonDays = 14
} = {}) {
  if (permission === "denied") {
    return {
      state: "denied",
      label: "Permissão Negada",
      message: "As notificações estão bloqueadas nas configurações do seu Android. Acesse as Configurações do sistema para permitir.",
      badgeClass: "badge-danger",
      canSchedule: false,
      exactAlarm,
      pendingCount: 0
    };
  }

  if (!enabled) {
    return {
      state: "disabled",
      label: "Lembretes Desativados",
      message: "Ative os lembretes para receber alertas locais no horário das suas aplicações.",
      badgeClass: "badge-neutral",
      canSchedule: false,
      exactAlarm,
      pendingCount: 0
    };
  }

  if (permission === "granted") {
    const isExactDenied = exactAlarm === "denied" || exactAlarm === "unknown";
    const exactMsg = isExactDenied
      ? ` (Alarmes exatos restritos no sistema; lembretes usarão janelas normais)`
      : "";

    return {
      state: "active",
      label: "Ativo & Agendado",
      message: `${pendingCount} lembretes agendados no sistema para os próximos ${horizonDays} dias.${exactMsg}`,
      badgeClass: "badge-success",
      canSchedule: true,
      exactAlarm,
      pendingCount: pendingCount
    };
  }

  return {
    state: "prompt",
    label: "Permissão Necessária",
    message: "O aplicativo precisa da sua autorização para agendar lembretes no aparelho.",
    badgeClass: "badge-warning",
    canSchedule: false,
    exactAlarm,
    pendingCount: 0
  };
}
