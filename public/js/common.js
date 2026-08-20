// ===== API client =====
const API = "/api/v1";

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}
async function apiPut(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(`${API}${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error((await res.json()).error || "Request failed");
}

// ===== UI helpers =====
function toast(msg, isError = false) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = isError ? "#b3492b" : "#1c2321";
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
}

function fmtPKR(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  if (Math.abs(num) >= 10000000) return "PKR " + (num / 10000000).toFixed(2) + " Cr";
  if (Math.abs(num) >= 100000) return "PKR " + (num / 100000).toFixed(2) + " Lac";
  return "PKR " + num.toLocaleString("en-PK");
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleCase(str) {
  if (!str) return "—";
  return String(str).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Simple modal controller: pass an id, it toggles .open on the backdrop
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// Highlights the current page's nav link based on data-page attr on <body>
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.getAttribute("data-page");
  document.querySelectorAll(".nav-link").forEach((a) => {
    if (a.getAttribute("data-nav") === page) a.classList.add("active");
  });
});

async function confirmDelete(label) {
  return window.confirm(`Delete this ${label}? This cannot be undone.`);
}
