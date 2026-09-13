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
  horizonDays = 90,
  eligibleRoutineCount = null
} = {}) {
  if (permission === "denied") {
    return {
      state: "denied",
      label: "Permissão Negada",
      labelKey: "modals.notifications.statusDenied",
      messageKey: "modals.notifications.statusDeniedMessage",
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
      labelKey: "modals.notifications.statusDisabled",
      messageKey: "modals.notifications.statusDisabledMessage",
      message: "Ative os lembretes para receber alertas locais no horário das suas aplicações.",
      badgeClass: "badge-neutral",
      canSchedule: false,
      exactAlarm,
      pendingCount: 0
    };
  }

  if (eligibleRoutineCount === 0 && pendingCount === 0) {
    return {
      state: "idle",
      label: "Ativo · Sem rotinas",
      labelKey: "modals.notifications.statusIdle",
      messageKey: "modals.notifications.statusIdleMessage",
      message: "As notificações estão ativas, mas nenhuma rotina com horário está habilitada para receber lembretes.",
      badgeClass: "badge-neutral",
      canSchedule: true,
      exactAlarm,
      pendingCount: 0
    };
  }

  if (permission === "granted") {
    const isExactDenied = exactAlarm === "denied" || exactAlarm === "unknown";
    const exactMsg = isExactDenied
      ? ` (Alarmes exatos restritos; o Android usará uma janela aproximada)`
      : "";

    return {
      state: "active",
      label: "Ativo & Agendado",
      labelKey: "modals.notifications.statusActive",
      messageKey: "modals.notifications.statusActiveMessage",
      messageParams: { pendingCount, horizonDays, exactRestricted: isExactDenied },
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
    labelKey: "modals.notifications.statusPrompt",
    messageKey: "modals.notifications.statusPromptMessage",
    message: "O aplicativo precisa da sua autorização para agendar lembretes no aparelho.",
    badgeClass: "badge-warning",
    canSchedule: false,
    exactAlarm,
    pendingCount: 0
  };
}
