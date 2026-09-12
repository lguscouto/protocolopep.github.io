/** Called only after a confirmed write. Feedback is never a persistence boundary. */
export function showActionFeedback(message) {
  if (!message) return;
  document.getElementById("pep-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "pep-toast";
  toast.className = "compact-success-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
