/**
 * Diccionario canónico de Internacionalización (i18n) — Español (es)
 * 
 * Principios de Gobernanza (AGENTS.md):
 * - Local-First & Offline: Diccionario estático integrado sin dependencias de red.
 * - No Prescripción: Textos informativos y neutros sin recomendaciones terapéuticas por defecto.
 */

export const es = {
  common: {
    today: "Hoy",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    close: "Cerrar",
    confirm: "Confirmar",
    back: "Volver",
    next: "Siguiente",
    finish: "Finalizar",
    loading: "Cargando...",
    success: "Éxito",
    error: "Error",
    warning: "Aviso",
    enabled: "ACTIVADO",
    disabled: "DESACTIVADO",
    connected: "CONECTADO",
    active: "ACTIVO",
    inactive: "INACTIVO",
    units: "UI",
    mcg: "mcg",
    mg: "mg",
    ml: "ml",
    kg: "kg",
    cm: "cm"
  },
  nav: {
    dashboard: "Dashboard",
    week: "Semana",
    history: "Historial",
    calculator: "Calculadora",
    settings: "Ajustes"
  },
  topbar: {
    title: "Protocolo PEP",
    notifications: "Recordatorios y Notificaciones",
    themeToggle: "Cambiar Tema (Claro / Oscuro)"
  },
  dashboard: {
    bannerText: "¡Tu opinión importa! <b>Contáctanos o envía sugerencias</b>",
    heading: "Tu Protocolo",
    dosesTakenToday: "tomados hoy",
    addPeptide: "Agregar Péptido al Protocolo",
    quickActions: "Acciones Rápidas",
    share: "Compartir",
    export: "Exportar",
    import: "Importar",
    calculator: "Calculadora",
    disclaimer: "Referencia personal e informativa. Los cálculos son estimaciones matemáticas y los registros se guardan solo en este dispositivo.<br>Confirma dosis, dilución y seguridad con un profesional de la salud.",
    emptyProtocolTitle: "Ningún péptido registrado",
    emptyProtocolDesc: "Toca el botón superior para agregar tu primer péptido y configurar los horarios de aplicación."
  },
  week: {
    heading: "Visión Semanal",
    subheading: "Seguimiento y frecuencia de aplicaciones para los próximos 7 días",
    dosesCount: "{count} aplicación(es) programada(s)"
  },
  history: {
    heading: "Historial de Aplicaciones",
    filterAll: "Todos",
    filterConfirmed: "Confirmados",
    filterSkipped: "Omitidos",
    emptyTitle: "No se encontraron registros",
    emptyDesc: "Las aplicaciones confirmadas o registradas aparecerán aquí en orden cronológico.",
    exportReport: "Exportar Reporte PDF / CSV"
  },
  calculator: {
    title: "Calculadora de Reconstitución",
    subtitle: "Calcula con seguridad la dilución y dosificación en jeringa",
    step1Title: "Cantidad de péptido en el vial",
    step1Desc: "Contenido total (mg)",
    step2Title: "Agua bacteriostática añadida",
    step2Desc: "Volumen de diluyente (ml)",
    step3Title: "Dosis deseada por aplicación",
    step3Desc: "Introduce la dosis prescrita",
    dosePlaceholder: "ej: 250",
    doseUnitMcg: "mcg",
    doseUnitMg: "mg",
    drawResultTitle: "UI",
    drawResultHint: "Indica la dosis deseada arriba para calcular las unidades (UI).",
    drawResultInstruction: "Carga hasta la marca de <b>{units} UI</b> en una jeringa de 100 UI",
    concentration: "Concentración de la solución",
    yield: "Rendimiento estimado",
    yieldValue: "{doses} dosis de {dose}"
  },
  settings: {
    heading: "Ajustes & Preferencias",
    languageTitle: "Idioma de la Aplicación",
    languageDesc: "Selecciona el idioma de visualización de Protocolo PEP",
    siteRotationTitle: "Rotación de Sitios",
    siteRotationDesc: "Siguiente en la rotación: <b>{site}</b> ({count} sitios activos)",
    siteConfigureBtn: "Configurar",
    securityTitle: "Seguridad & Privacidad",
    securityDesc: "Exigir biometría o PIN del dispositivo para abrir la aplicación.",
    securityToggle: "Bloqueo por Biometría / PIN",
    widgetTitle: "Widget de Pantalla de Inicio",
    widgetBadge: "WIDGET 3X2",
    widgetDesc: "Añade el widget a la pantalla de inicio de Android manteniendo pulsado un espacio vacío y seleccionando Protocolo PEP.",
    widgetDiscreteToggle: "Modo Discreto (ocultar nombres de péptidos)",
    healthConnectTitle: "Health Connect (Android)",
    healthConnectDesc: "Sincronización de peso y medidas corporales",
    healthConnectHelp: "Integración opcional y privada con el subsistema de salud de Android para sincronizar registros de peso.",
    healthConnectToggle: "Sincronizar con Health Connect",
    healthConnectSyncBtn: "Sincronizar Ahora",
    healthConnectSettingsBtn: "Configuraciones",
    remindersTitle: "Recordatorios & Notificaciones",
    remindersStatus: "ACTIVO & PROGRAMADO",
    remindersDesc: "{count} recordatorios programados en el sistema para los próximos 14 días.",
    remindersConfigureBtn: "Configurar Recordatorios",
    localFirstTitle: "Arquitectura 100% Local-First",
    localFirstDesc: "Todos tus datos de protocolo e historial están guardados directamente en la memoria de tu dispositivo, funcionando offline con máxima privacidad y rapidez.",
    exportBackupBtn: "Exportar Backup JSON",
    importBackupBtn: "Importar Backup",
    lastBackup: "Último backup exportado: {date}",
    appInfo: "Protocolo PEP Android",
    diagnosticsBtn: "Diagnósticos",
    termsBtn: "Términos & Privacidad"
  },
  modals: {
    addPeptideTitle: "Nuevo Péptido",
    editPeptideTitle: "Editar Péptido",
    nameLabel: "Nombre del Péptido",
    doseLabel: "Dosis por Aplicación",
    frequencyLabel: "Frecuencia",
    scheduleLabel: "Horario de la Aplicación",
    confirmDeleteTitle: "¿Eliminar Péptido?",
    confirmDeleteMessage: "Esta acción no se puede deshacer. Todos los recordatorios vinculados serán eliminados.",
    confirmLogTitle: "Confirmar Aplicación",
    confirmLogMessage: "¿Deseas marcar la dosis de {name} ({dose}) como aplicada ahora?",
    siteSelectTitle: "Selecciona el Sitio de Aplicación",
    injectionNotePlaceholder: "Notas u observaciones (opcional)"
  },
  notifications: {
    doseReminderTitle: "Hora de tu aplicación — {peptide}",
    doseReminderBody: "Dosis programada de {dose} ({units} UI). Toca para confirmar la aplicación en Protocolo PEP."
  }
};
