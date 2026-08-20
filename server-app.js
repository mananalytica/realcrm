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
app.use("/api/v1/financials", require("./routes/financials"));
app.use("/api/v1/dashboard", require("./routes/dashboard"));

app.get("/api/v1/health", (req, res) =>
  res.json({ ok: true, mode: process.env.MOTHERDUCK_TOKEN ? "motherduck" : "local-duckdb" })
);

module.exports = app;
