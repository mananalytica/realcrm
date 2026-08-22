const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/index.html" },
  { key: "contacts", label: "Contacts", href: "/contacts.html" },
  { key: "properties", label: "Properties", href: "/properties.html" },
  { key: "leads", label: "Leads", href: "/leads.html" },
  { key: "deals", label: "Deals Pipeline", href: "/deals.html" },
  { key: "tasks", label: "Tasks", href: "/tasks.html" },
  { key: "documents", label: "Documents", href: "/documents.html" },
  { key: "financials", label: "Financials", href: "/financials.html" },
  { key: "invoices", label: "Invoices", href: "/invoices.html" },
  { key: "import", label: "Import Data", href: "/import.html" },
  { key: "settings", label: "Business Profile", href: "/settings.html" },
];

document.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("sidebar-mount");
  if (!mount) return;
  const page = document.body.getAttribute("data-page");
  mount.innerHTML = `
    <div class="brand">Kaghazi CRM<small>Solo Agent &middot; Pakistan</small></div>
    ${NAV_ITEMS.map(
      (item) => `
      <a class="nav-link ${item.key === page ? "active" : ""}" data-nav="${item.key}" href="${item.href}">
        <span class="dot"></span>${item.label}
      </a>`
    ).join("")}
  `;
});
