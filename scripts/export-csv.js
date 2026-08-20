/**
 * Generates the same realistic synthetic dataset as db/seed.js, but as CSV
 * files instead of writing directly to a database. Useful when you want to
 * import via the dashboard's Import page (e.g. into a MotherDuck-backed
 * Vercel deployment you don't have shell/env access to).
 *
 * Usage: node scripts/export-csv.js [outputDir] [contactCount]
 *   node scripts/export-csv.js ./sample-data 1000
 */

const fs = require("fs");
const path = require("path");
const { buildDataset } = require("../db/generators");

const outDir = process.argv[2] || path.join(__dirname, "..", "sample-data");
const contactCount = parseInt(process.argv[3] || "1000", 10);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(filename, columns, rows) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  }
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
  console.log(`  wrote ${rows.length} rows -> ${filePath}`);
}

console.log(`Generating sample dataset (${contactCount} contacts base scale)...`);
const { contacts, properties, leads, deals, tasks, financials } = buildDataset({ contactCount });

writeCsv("contacts.csv", [
  "id", "contact_type", "name", "phone", "whatsapp", "cnic", "city", "budget_min", "budget_max",
  "preferred_areas", "preferred_size_unit", "preferred_size_value", "purpose", "lead_source", "created_at",
], contacts);

writeCsv("properties.csv", [
  "id", "property_type", "purpose", "size_unit", "size_value", "city", "area", "society", "phase", "block",
  "plot_number", "file_number", "file_type", "payment_plan_status", "transfer_fee_status", "asking_price",
  "rent_price", "dc_rate", "market_rate", "development_charges_status", "possession_status",
  "verification_status", "status", "owner_contact_id", "created_at",
], properties);

writeCsv("leads.csv", ["id", "contact_id", "status", "requirements", "lead_score", "created_at"], leads);

writeCsv("deals.csv", [
  "id", "property_id", "buyer_contact_id", "seller_contact_id", "deal_type", "stage", "token_amount",
  "token_date", "commission_percentage", "commission_amount", "expected_close_date", "actual_close_date",
  "notes", "created_at",
], deals);

writeCsv("tasks.csv", [
  "id", "title", "description", "due_date", "status", "priority", "related_type", "related_id", "created_at",
], tasks);

writeCsv("financials.csv", [
  "id", "entry_type", "category", "amount", "deal_id", "description", "entry_date",
], financials);

const closedWon = deals.filter((d) => d.stage === "closed_won").length;
console.log("\nDone.");
console.log(`  Contacts: ${contacts.length}, Properties: ${properties.length}, Leads: ${leads.length}`);
console.log(`  Deals: ${deals.length} (closed_won: ${closedWon}), Tasks: ${tasks.length}, Financials: ${financials.length}`);
console.log(`  Overall lead -> closed-won conversion: ${((closedWon / leads.length) * 100).toFixed(2)}%`);
console.log("\nImport order matters (later files reference ids from earlier ones):");
console.log("  1. contacts.csv   2. properties.csv   3. leads.csv   4. deals.csv   5. tasks.csv   6. financials.csv");
