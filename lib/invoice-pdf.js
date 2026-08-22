const PDFDocument = require("pdfkit");

function fmtPKR(n) {
  const num = Number(n || 0);
  return "PKR " + num.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDate(d) {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Streams a PDF invoice to the given writable stream (typically an HTTP response).
 * @param {object} invoice - row from the invoices table
 * @param {object} contact - the billed-to contact (may be null)
 * @param {object} settings - row from the settings table (agency profile)
 * @param {import('stream').Writable} stream
 */
function renderInvoicePdf(invoice, contact, settings, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(stream);

  const green = "#14532d";
  const ink = "#1c2321";
  const slate = "#5b6b66";
  const line = "#ddd4bd";

  // ---------- Header ----------
  doc.fillColor(green).fontSize(20).font("Helvetica-Bold").text(settings?.business_name || "Real Estate Agency", 50, 50);
  doc.fillColor(slate).fontSize(9).font("Helvetica");
  let y = 75;
  if (settings?.owner_name) { doc.text(settings.owner_name, 50, y); y += 13; }
  if (settings?.address) { doc.text(settings.address, 50, y, { width: 260 }); y += 26; }
  if (settings?.phone) { doc.text(`Phone: ${settings.phone}`, 50, y); y += 13; }
  if (settings?.email) { doc.text(`Email: ${settings.email}`, 50, y); y += 13; }
  if (settings?.ntn) { doc.text(`NTN: ${settings.ntn}`, 50, y); y += 13; }
  if (settings?.strn) { doc.text(`STRN: ${settings.strn}`, 50, y); y += 13; }

  doc.fillColor(ink).fontSize(24).font("Helvetica-Bold").text("INVOICE", 350, 50, { width: 195, align: "right" });
  doc.fillColor(slate).fontSize(10).font("Helvetica");
  doc.text(`Invoice #: ${invoice.invoice_number || invoice.id.slice(0, 8)}`, 350, 82, { width: 195, align: "right" });
  doc.text(`Issue date: ${fmtDate(invoice.issue_date)}`, 350, 97, { width: 195, align: "right" });
  doc.text(`Due date: ${fmtDate(invoice.due_date)}`, 350, 112, { width: 195, align: "right" });

  doc.moveTo(50, Math.max(y, 140) + 10).lineTo(545, Math.max(y, 140) + 10).strokeColor(line).lineWidth(1).stroke();

  // ---------- Bill To ----------
  let by = Math.max(y, 140) + 25;
  doc.fillColor(slate).fontSize(9).font("Helvetica-Bold").text("BILL TO", 50, by);
  by += 15;
  doc.fillColor(ink).fontSize(11).font("Helvetica-Bold").text(contact?.name || "Client", 50, by);
  by += 15;
  doc.fillColor(slate).fontSize(9).font("Helvetica");
  if (contact?.phone || contact?.whatsapp) { doc.text(contact.phone || contact.whatsapp, 50, by); by += 13; }
  if (contact?.cnic) { doc.text(`CNIC: ${contact.cnic}`, 50, by); by += 13; }
  if (contact?.address || contact?.city) { doc.text([contact.address, contact.city].filter(Boolean).join(", "), 50, by, { width: 260 }); by += 13; }

  // ---------- Line item table ----------
  const tableTop = by + 25;
  doc.fillColor("#fff").rect(50, tableTop, 495, 22).fill(green);
  doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold");
  doc.text("DESCRIPTION", 60, tableTop + 6);
  doc.text("AMOUNT", 430, tableTop + 6, { width: 105, align: "right" });

  let rowY = tableTop + 32;
  doc.fillColor(ink).fontSize(10).font("Helvetica");
  doc.text(invoice.description || "Real estate commission", 60, rowY, { width: 360 });
  doc.text(fmtPKR(invoice.subtotal), 430, rowY, { width: 105, align: "right" });
  rowY += 25;

  doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor(line).lineWidth(0.5).stroke();
  rowY += 12;

  // Subtotal / tax / net breakdown - Pakistani withholding tax convention:
  // the client withholds tax at source and remits it to FBR under the
  // agent's NTN, so the agent actually receives the NET figure, not gross.
  const labelX = 300, labelW = 140, valX = 445, valW = 100;
  doc.fontSize(9).fillColor(slate).font("Helvetica");
  doc.text("Gross Commission", labelX, rowY, { width: labelW, align: "left" });
  doc.text(fmtPKR(invoice.subtotal), valX, rowY, { width: valW, align: "right" });
  rowY += 16;

  if (invoice.tax_amount) {
    const taxLabelText = invoice.tax_label || `Less: Withholding Tax (${invoice.tax_rate}%)`;
    const taxLabelHeight = doc.heightOfString(taxLabelText, { width: labelW });
    doc.text(taxLabelText, labelX, rowY, { width: labelW, align: "left" });
    doc.text(`- ${fmtPKR(invoice.tax_amount)}`, valX, rowY, { width: valW, align: "right" });
    rowY += Math.max(taxLabelHeight, 12) + 6;
  }

  doc.moveTo(labelX, rowY + 2).lineTo(545, rowY + 2).strokeColor(line).lineWidth(0.5).stroke();
  rowY += 12;

  doc.fillColor(green).fontSize(12).font("Helvetica-Bold");
  doc.text("Net Amount Payable", labelX, rowY, { width: labelW, align: "left" });
  doc.text(fmtPKR(invoice.net_total), valX, rowY, { width: valW, align: "right" });
  rowY += 35;

  // ---------- Payment details ----------
  if (settings?.bank_details) {
    doc.fillColor(slate).fontSize(9).font("Helvetica-Bold").text("PAYMENT DETAILS", 50, rowY);
    rowY += 14;
    doc.fillColor(ink).fontSize(9).font("Helvetica").text(settings.bank_details, 50, rowY, { width: 400 });
    rowY += 40;
  }

  if (invoice.notes) {
    doc.fillColor(slate).fontSize(9).font("Helvetica-Bold").text("NOTES", 50, rowY);
    rowY += 14;
    doc.fillColor(ink).fontSize(9).font("Helvetica").text(invoice.notes, 50, rowY, { width: 495 });
    rowY += 30;
  }

  // ---------- Footer ----------
  doc.fillColor(slate).fontSize(8).font("Helvetica").text(
    settings?.invoice_footer_note || "Thank you for your business.",
    50, 760, { width: 495, align: "center" }
  );

  doc.end();
}

module.exports = { renderInvoicePdf };
