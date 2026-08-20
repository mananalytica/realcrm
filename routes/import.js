const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { TABLES } = require("../db/table-configs");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isNaN(v) ? "NULL" : String(v);
  return sqlStr(v);
}

async function bulkInsert(table, columns, rows, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map((row) => `(${columns.map((c) => sqlVal(row[c])).join(", ")})`);
    await db.run(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.join(", ")}`);
  }
}

// GET /api/v1/import/tables - lists importable tables + their expected columns (for the UI to render hints)
router.get("/tables", (req, res) => {
  res.json(
    Object.entries(TABLES).map(([table, cfg]) => ({
      table,
      columns: cfg.columns,
      required: cfg.required,
    }))
  );
});

// POST /api/v1/import/:table  (multipart, field name "file"; optional field "replace"="true")
router.post("/:table", upload.single("file"), async (req, res) => {
  const table = req.params.table;
  const cfg = TABLES[table];
  if (!cfg) {
    return res.status(400).json({ error: `Unknown or non-importable table "${table}"` });
  }
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded" });
  }

  let records;
  try {
    records = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: "Could not parse CSV: " + err.message });
  }

  if (!records.length) {
    return res.status(400).json({ error: "CSV file has no data rows" });
  }

  const columns = ["id", ...cfg.columns];
  const rows = [];
  const errors = [];

  records.forEach((record, idx) => {
    const missing = cfg.required.filter((c) => !record[c] || String(record[c]).trim() === "");
    if (missing.length) {
      errors.push(`Row ${idx + 2}: missing required field(s) ${missing.join(", ")}`);
      return;
    }
    const row = { id: record.id && record.id.trim() ? record.id.trim() : uuidv4() };
    for (const col of cfg.columns) {
      let val = record[col];
      if (val === undefined || val === null || String(val).trim() === "") {
        row[col] = null;
        continue;
      }
      val = String(val).trim();
      if (cfg.numeric.includes(col)) {
        const num = Number(val);
        row[col] = Number.isNaN(num) ? null : num;
      } else {
        row[col] = val;
      }
    }
    rows.push(row);
  });

  if (!rows.length) {
    return res.status(400).json({ error: "No valid rows to import", details: errors.slice(0, 20) });
  }

  try {
    if (String(req.body.replace).toLowerCase() === "true") {
      await db.run(`DELETE FROM ${table}`);
    }
    await bulkInsert(table, columns, rows);
    res.status(201).json({
      table,
      inserted: rows.length,
      skipped: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    res.status(500).json({ error: "Import failed: " + err.message });
  }
});

module.exports = router;
