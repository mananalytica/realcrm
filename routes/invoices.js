const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { renderInvoicePdf } = require("../lib/invoice-pdf");

const router = express.Router();

const COLUMNS = [
  "invoice_number", "deal_id", "contact_id", "description", "subtotal", "tax_label", "tax_rate",
  "tax_amount", "net_total", "currency", "issue_date", "due_date", "scheduled_send_at", "status",
  "sent_at", "paid_at", "notes",
];

async function nextInvoiceNumber() {
  await db.run(
    `INSERT INTO settings (id, next_invoice_seq) VALUES ('default', 2)
     ON CONFLICT (id) DO UPDATE SET next_invoice_seq = settings.next_invoice_seq + 1`
  );
  const rows = await db.all(`SELECT next_invoice_seq FROM settings WHERE id = 'default'`);
  const seq = (rows[0] && rows[0].next_invoice_seq ? rows[0].next_invoice_seq : 2) - 1;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(seq).padStart(4, "0")}`;
}

function computeTotals(body) {
  const subtotal = Number(body.subtotal || 0);
  const taxRate = Number(body.tax_rate || 0);
  const taxAmount = Math.round((subtotal * taxRate) / 100);
  const netTotal = subtotal - taxAmount;
  return { subtotal, tax_amount: taxAmount, net_total: netTotal };
}

// LIST (optional ?status=, ?deal_id=, ?contact_id= filters)
router.get("/", async (req, res) => {
  try {
    const filters = [];
    const params = [];
    ["status", "deal_id", "contact_id"].forEach((f) => {
      if (req.query[f]) { filters.push(`${f} = ?`); params.push(req.query[f]); }
    });
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = await db.all(`SELECT * FROM invoices ${where} ORDER BY created_at DESC`, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const rows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Invoice not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE
router.post("/", async (req, res) => {
  try {
    const id = uuidv4();
    const invoiceNumber = req.body.invoice_number || (await nextInvoiceNumber());
    const totals = computeTotals(req.body);
    const status = req.body.scheduled_send_at ? "scheduled" : (req.body.status || "draft");

    const values = {
      invoice_number: invoiceNumber,
      deal_id: req.body.deal_id || null,
      contact_id: req.body.contact_id || null,
      description: req.body.description || null,
      subtotal: totals.subtotal,
      tax_label: req.body.tax_label || null,
      tax_rate: Number(req.body.tax_rate || 0),
      tax_amount: totals.tax_amount,
      net_total: totals.net_total,
      currency: "PKR",
      issue_date: req.body.issue_date || new Date().toISOString().slice(0, 10),
      due_date: req.body.due_date || null,
      scheduled_send_at: req.body.scheduled_send_at || null,
      status,
      sent_at: null,
      paid_at: null,
      notes: req.body.notes || null,
    };

    const cols = ["id", ...COLUMNS];
    const placeholders = cols.map(() => "?").join(", ");
    await db.run(`INSERT INTO invoices (${cols.join(", ")}) VALUES (${placeholders})`, [id, ...COLUMNS.map((c) => values[c])]);

    const rows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const existingRows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: "Invoice not found" });
    const existing = existingRows[0];

    const merged = { ...existing, ...req.body };
    const totals = computeTotals(merged);

    const updatable = COLUMNS.filter((c) => req.body[c] !== undefined);
    if (!updatable.length && req.body.subtotal === undefined && req.body.tax_rate === undefined) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Always recompute tax_amount/net_total if subtotal or tax_rate changed
    const fieldsToSet = new Set(updatable);
    if (req.body.subtotal !== undefined || req.body.tax_rate !== undefined) {
      fieldsToSet.add("tax_amount"); fieldsToSet.add("net_total");
      merged.tax_amount = totals.tax_amount;
      merged.net_total = totals.net_total;
    }
    // Auto-transition to "scheduled" if a schedule date is newly set
    if (req.body.scheduled_send_at && existing.status === "draft") {
      fieldsToSet.add("status");
      merged.status = "scheduled";
    }

    const setClauses = [...fieldsToSet].map((c) => `${c} = ?`);
    setClauses.push("updated_at = current_timestamp");
    const values = [...fieldsToSet].map((c) => merged[c]);
    values.push(req.params.id);

    await db.run(`UPDATE invoices SET ${setClauses.join(", ")} WHERE id = ?`, values);
    const rows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.run(`DELETE FROM invoices WHERE id = ?`, [req.params.id]);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark as sent / paid - small dedicated actions rather than making the
// frontend build a full update payload for a one-field status change
router.post("/:id/mark-sent", async (req, res) => {
  try {
    await db.run(`UPDATE invoices SET status = 'sent', sent_at = current_timestamp, updated_at = current_timestamp WHERE id = ?`, [req.params.id]);
    const rows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post("/:id/mark-paid", async (req, res) => {
  try {
    await db.run(`UPDATE invoices SET status = 'paid', paid_at = current_timestamp, updated_at = current_timestamp WHERE id = ?`, [req.params.id]);
    const rows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PDF download
router.get("/:id/pdf", async (req, res) => {
  try {
    const invRows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    if (!invRows.length) return res.status(404).json({ error: "Invoice not found" });
    const invoice = invRows[0];

    const contactRows = invoice.contact_id ? await db.all(`SELECT * FROM contacts WHERE id = ?`, [invoice.contact_id]) : [];
    const settingsRows = await db.all(`SELECT * FROM settings WHERE id = 'default'`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${invoice.invoice_number || "invoice"}.pdf"`);
    renderInvoicePdf(invoice, contactRows[0] || null, settingsRows[0] || null, res);
  } catch (err) {
    res.status(500).json({ error: "PDF generation failed: " + err.message });
  }
});

// WhatsApp click-to-chat link - works today with zero API setup. Builds a
// wa.me link with a prefilled message + a link to the invoice PDF. Once the
// WhatsApp Business API is wired up later, this endpoint's response shape
// stays useful (message text + PDF URL) even if the send path changes.
router.get("/:id/whatsapp-link", async (req, res) => {
  try {
    const invRows = await db.all(`SELECT * FROM invoices WHERE id = ?`, [req.params.id]);
    if (!invRows.length) return res.status(404).json({ error: "Invoice not found" });
    const invoice = invRows[0];

    const contactRows = invoice.contact_id ? await db.all(`SELECT * FROM contacts WHERE id = ?`, [invoice.contact_id]) : [];
    const contact = contactRows[0];
    if (!contact || !(contact.whatsapp || contact.phone)) {
      return res.status(400).json({ error: "This contact has no phone/WhatsApp number on file" });
    }

    // Normalize to international format for wa.me (expects digits only, no +)
    let phone = (contact.whatsapp || contact.phone).replace(/[^\d]/g, "");
    if (phone.startsWith("0")) phone = "92" + phone.slice(1); // Pakistani local -> +92
    else if (!phone.startsWith("92")) phone = "92" + phone;

    const settingsRows = await db.all(`SELECT * FROM settings WHERE id = 'default'`);
    const settings = settingsRows[0] || {};
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const pdfUrl = `${baseUrl}/api/v1/invoices/${invoice.id}/pdf`;

    const message =
      `Assalam-o-Alaikum ${contact.name},\n\n` +
      `Invoice ${invoice.invoice_number} from ${settings.business_name || "us"} - ${invoice.description || "services rendered"}.\n` +
      `Net Amount: PKR ${Number(invoice.net_total || 0).toLocaleString("en-PK")}\n` +
      `Due: ${invoice.due_date || "-"}\n\n` +
      `View/download: ${pdfUrl}`;

    const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    res.json({ link, phone, message });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
