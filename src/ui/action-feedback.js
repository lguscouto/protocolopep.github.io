/** Called only after a confirmed write. Feedback is never a persistence boundary. */
export function showActionFeedback(message, { variant = "success", duration = 4000 } = {}) {
  if (!message) return;
  document.getElementById("pep-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "pep-toast";
  toast.className = `compact-success-toast feedback-${["success", "error", "info"].includes(variant) ? variant : "success"}`;
  toast.setAttribute("role", variant === "error" ? "alert" : "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), Math.max(0, Number(duration) || 4000));
}
