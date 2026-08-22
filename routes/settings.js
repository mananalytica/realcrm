const express = require("express");
const db = require("../db");

const router = express.Router();

const COLUMNS = ["business_name", "owner_name", "address", "phone", "email", "ntn", "strn", "bank_details", "invoice_footer_note"];

router.get("/", async (req, res) => {
  try {
    const rows = await db.all(`SELECT * FROM settings WHERE id = 'default'`);
    res.json(rows[0] || { id: "default" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/", async (req, res) => {
  try {
    const values = COLUMNS.map((c) => req.body[c] ?? null);
    // Upsert the single settings row
    await db.run(
      `INSERT INTO settings (id, ${COLUMNS.join(", ")}) VALUES ('default', ${COLUMNS.map(() => "?").join(", ")})
       ON CONFLICT (id) DO UPDATE SET ${COLUMNS.map((c) => `${c} = excluded.${c}`).join(", ")}, updated_at = now()`,
      values
    );
    const rows = await db.all(`SELECT * FROM settings WHERE id = 'default'`);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
