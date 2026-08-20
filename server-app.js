const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const db = require("./db");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Ensure DB/schema is ready before handling requests (works for cold starts too)
app.use(async (req, res, next) => {
  try {
    await db.init();
    next();
  } catch (err) {
    res.status(500).json({ error: "Database initialization failed: " + err.message });
  }
});

app.use("/api/v1/contacts", require("./routes/contacts"));
app.use("/api/v1/properties", require("./routes/properties"));
app.use("/api/v1/leads", require("./routes/leads"));
app.use("/api/v1/deals", require("./routes/deals"));
app.use("/api/v1/tasks", require("./routes/tasks"));
app.use("/api/v1/documents", require("./routes/documents"));
app.use("/api/v1/documents-upload", require("./routes/upload"));
app.use("/api/v1/import", require("./routes/import"));
app.use("/api/v1/financials", require("./routes/financials"));
app.use("/api/v1/dashboard", require("./routes/dashboard"));

app.get("/api/v1/health", async (req, res) => {
  const mode = process.env.MOTHERDUCK_TOKEN ? "motherduck" : "local-duckdb";
  try {
    const db = require("./db");
    const info = await db.whereAmI();
    const counts = {};
    for (const t of ["contacts", "properties", "leads", "deals", "tasks", "financials"]) {
      const rows = await db.all(`SELECT COUNT(*) AS n FROM ${t}`);
      counts[t] = Number(rows[0].n);
    }
    res.json({
      ok: true,
      mode,
      configuredDatabase: process.env.MOTHERDUCK_DATABASE || "pak_crm",
      connectedDatabase: info.db,
      connectedSchema: info.schema,
      rowCounts: counts,
    });
  } catch (err) {
    res.status(500).json({ ok: false, mode, error: err.message });
  }
});

module.exports = app;
