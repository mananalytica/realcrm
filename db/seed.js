/**
 * Seed script: generates a realistic synthetic dataset directly into the
 * database (local DuckDB file, or MotherDuck if MOTHERDUCK_TOKEN is set)
 * so the dashboard, kanban board, and reports have something meaningful
 * to show.
 *
 * Usage: npm run seed
 *
 * See db/generators.js for the conversion-funnel logic. At the default
 * scale (10,000 contacts) this produces ~1.7-2% overall lead-to-close,
 * matching realistic solo-agent / mixed cold-inbound benchmarks.
 */

const db = require("./index");
const { buildDataset } = require("./generators");

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isNaN(v) ? "NULL" : String(v);
  return sqlStr(v);
}

async function bulkInsert(table, columns, rows, batchSize = 1000) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map((row) => `(${columns.map((c) => sqlVal(row[c])).join(", ")})`);
    await db.run(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.join(", ")}`);
  }
  console.log(`  inserted ${rows.length} rows into ${table}`);
}

async function main() {
  console.log("Initializing database...");
  await db.init();

  console.log("Clearing existing data...");
  for (const t of ["financials", "documents", "tasks", "deals", "leads", "properties", "messages", "contacts"]) {
    await db.run(`DELETE FROM ${t}`);
  }

  console.log("Generating dataset (10,000 contacts base scale)...");
  const { contacts, properties, leads, deals, tasks, financials } = buildDataset({ contactCount: 10000 });

  await bulkInsert("contacts", [
    "id", "contact_type", "name", "phone", "whatsapp", "cnic", "city", "budget_min", "budget_max",
    "preferred_areas", "preferred_size_unit", "preferred_size_value", "purpose", "lead_source", "created_at",
  ], contacts);

  await bulkInsert("properties", [
    "id", "property_type", "purpose", "size_unit", "size_value", "city", "area", "society", "phase", "block",
    "plot_number", "file_number", "file_type", "payment_plan_status", "transfer_fee_status", "asking_price",
    "rent_price", "dc_rate", "market_rate", "development_charges_status", "possession_status",
    "verification_status", "status", "owner_contact_id", "created_at",
  ], properties);

  await bulkInsert("leads", ["id", "contact_id", "status", "requirements", "lead_score", "created_at"], leads);

  await bulkInsert("deals", [
    "id", "property_id", "buyer_contact_id", "seller_contact_id", "deal_type", "stage", "token_amount",
    "token_date", "commission_percentage", "commission_amount", "expected_close_date", "actual_close_date",
    "notes", "created_at",
  ], deals);

  await bulkInsert("tasks", [
    "id", "title", "description", "due_date", "status", "priority", "related_type", "related_id", "created_at",
  ], tasks);

  await bulkInsert("financials", [
    "id", "entry_type", "category", "amount", "deal_id", "description", "entry_date",
  ], financials);

  const closedWon = deals.filter((d) => d.stage === "closed_won").length;
  console.log("\nSeed complete.");
  console.log(`  Contacts: ${contacts.length}`);
  console.log(`  Properties: ${properties.length}`);
  console.log(`  Leads: ${leads.length}`);
  console.log(`  Deals: ${deals.length} (closed_won: ${closedWon})`);
  console.log(`  Tasks: ${tasks.length}`);
  console.log(`  Financial entries: ${financials.length}`);
  console.log(`  Overall lead -> closed-won conversion: ${((closedWon / leads.length) * 100).toFixed(2)}%`);
  console.log(`  Lead -> deal conversion: ${((deals.length / leads.length) * 100).toFixed(2)}%`);
  console.log(`  Deal -> closed-won conversion: ${((closedWon / deals.length) * 100).toFixed(2)}%`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); });
