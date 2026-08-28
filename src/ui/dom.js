/**
 * Utilitários de Construção Segura do DOM e Prevenção de XSS
 */

import { validateHexColor } from "../domain/protocol.js";

export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeAttribute(val) {
  if (val === null || val === undefined) return "";
  return String(val).replace(/["'<>]/g, "");
}

export function sanitizeId(id) {
  if (typeof id !== "string") return "";
  return id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export { validateHexColor as sanitizeColor };

export function el(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);

  Object.entries(attrs).forEach(([key, val]) => {
    if (key === "className" || key === "class") {
      element.className = val;
    } else if (key === "textContent" || key === "text") {
      element.textContent = val;
    } else if (key === "innerHTML") {
      // innerHTML deve ser usado com extremo cuidado, apenas para SVGs/templates estáticos
      element.innerHTML = val;
    } else if (key.startsWith("on") && typeof val === "function") {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, val);
    } else if (key.startsWith("data-")) {
      element.setAttribute(key, sanitizeAttribute(val));
    } else if (key === "style" && typeof val === "object") {
      Object.assign(element.style, val);
    } else if (val !== null && val !== undefined && val !== false) {
      element.setAttribute(key, String(val));
    }
  });

  if (Array.isArray(children)) {
    children.forEach((child) => {
      if (child instanceof Node) {
        element.appendChild(child);
      } else if (typeof child === "string" || typeof child === "number") {
        element.appendChild(document.createTextNode(String(child)));
      }
    });
  } else if (children instanceof Node) {
    element.appendChild(children);
  } else if (typeof children === "string" || typeof children === "number") {
    element.appendChild(document.createTextNode(String(children)));
  }

  return element;
}

export function clearAndAppend(container, ...nodes) {
  if (!container) return;
  container.innerHTML = "";
  nodes.forEach((n) => {
    if (n instanceof Node) container.appendChild(n);
  });
}
