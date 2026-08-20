const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

/**
 * Builds a standard REST router (GET list, GET one, POST, PUT, DELETE) for a table.
 * @param {string} table - table name
 * @param {string[]} columns - insertable/updatable column names (excludes id, created_at, updated_at)
 * @param {object} opts - { orderBy, hasUpdatedAt }
 */
function crudRouter(table, columns, opts = {}) {
  const router = express.Router();
  const orderBy = opts.orderBy || "created_at DESC";
  const hasUpdatedAt = opts.hasUpdatedAt !== false;

  // LIST with optional simple filtering via query params matching column names
  router.get("/", async (req, res) => {
    try {
      const filters = [];
      const params = [];
      for (const col of columns) {
        if (req.query[col] !== undefined && req.query[col] !== "") {
          filters.push(`${col} = ?`);
          params.push(req.query[col]);
        }
      }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await db.all(`SELECT * FROM ${table} ${where} ORDER BY ${orderBy}`, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET ONE
  router.get("/:id", async (req, res) => {
    try {
      const rows = await db.all(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: `${table} not found` });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // CREATE
  router.post("/", async (req, res) => {
    try {
      const id = uuidv4();
      const cols = ["id", ...columns.filter((c) => req.body[c] !== undefined)];
      const values = cols.map((c) => (c === "id" ? id : req.body[c]));
      const placeholders = cols.map(() => "?").join(", ");
      await db.run(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`, values);
      const rows = await db.all(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      res.status(201).json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // UPDATE
  router.put("/:id", async (req, res) => {
    try {
      const updatable = columns.filter((c) => req.body[c] !== undefined);
      if (!updatable.length) return res.status(400).json({ error: "No fields to update" });
      const setClauses = updatable.map((c) => `${c} = ?`);
      if (hasUpdatedAt) setClauses.push("updated_at = current_timestamp");
      const values = updatable.map((c) => req.body[c]);
      values.push(req.params.id);
      await db.run(`UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = ?`, values);
      const rows = await db.all(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: `${table} not found` });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  router.delete("/:id", async (req, res) => {
    try {
      await db.run(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = crudRouter;
