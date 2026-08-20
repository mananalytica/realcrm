const { DuckDBInstance } = require("@duckdb/node-api");
const fs = require("fs");
const path = require("path");

// Local dev: plain DuckDB file on disk (./data/crm.duckdb)
// Production: set MOTHERDUCK_TOKEN in env and this attaches to your MotherDuck cloud DB instead.
const MD_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MD_DB_NAME = process.env.MOTHERDUCK_DATABASE || "pak_crm";
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(__dirname, "..", "data", "crm.duckdb");

// On Vercel (and most serverless platforms) only /tmp is writable - the deployed
// code bundle itself is read-only. DuckDB needs somewhere writable to download
// and cache the "motherduck" extension on first connect. If HOME points to a
// read-only location, that download silently fails or the connection errors.
// This makes sure DuckDB's default extension cache dir (~/.duckdb) resolves
// to a writable path regardless of platform.
if (!process.env.HOME || !isWritable(process.env.HOME)) {
  process.env.HOME = fs.existsSync("/tmp") ? "/tmp" : process.env.HOME;
}
function isWritable(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true; } catch { return false; }
}

let connection;
let ready;

async function init() {
  if (ready) return ready;

  ready = withTimeout(
    (async () => {
      let instance;
      if (MD_TOKEN) {
        // Pass the token directly in the connection string rather than only via
        // the `motherduck_token` env var - more reliable across cold starts and
        // avoids any env-var casing/timing pitfalls in serverless environments.
        instance = await DuckDBInstance.create(`md:${MD_DB_NAME}?motherduck_token=${encodeURIComponent(MD_TOKEN)}`);
      } else {
        const dataDir = path.dirname(LOCAL_DB_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        instance = await DuckDBInstance.create(LOCAL_DB_PATH);
      }
      connection = await instance.connect();
      const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
      // DuckDB's simple protocol allows multiple ;-separated statements in one run() call
      await connection.run(schema);
    })(),
    45000,
    "Database connection timed out after 45s. If this is a MotherDuck connection, the most " +
    "likely cause is a cold start still downloading the 'motherduck' extension, or the " +
    "MOTHERDUCK_TOKEN being invalid/missing. Check your Vercel project's environment " +
    "variables (and redeploy after changing them - Vercel doesn't pick up env var " +
    "changes on existing deployments)."
  );

  // If init fails, don't cache the rejected promise - let the next request retry
  // cleanly rather than being stuck replaying the same failure forever.
  ready.catch(() => { ready = null; });

  return ready;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

// Diagnostic helper - actually queries which database/schema this connection
// is attached to right now, so you can confirm it matches what you see in
// the MotherDuck UI. Surfaced on GET /api/v1/health.
async function whereAmI() {
  await init();
  const reader = await connection.runAndReadAll("SELECT current_database() AS db, current_schema() AS schema");
  const rows = reader.getRowObjectsJson();
  return rows[0] || {};
}

// Converts a `?` positional-placeholder SQL string + values array into
// DuckDB's named-parameter form ($p0, $p1, ...) so callers can keep using
// the familiar "?" style used by most SQL wrapper libraries.
function toNamedParams(sql, params) {
  let i = 0;
  const paramObj = {};
  const namedSql = sql.replace(/\?/g, () => {
    const key = `p${i}`;
    paramObj[key] = params[i] === undefined ? null : params[i];
    i++;
    return `$${key}`;
  });
  return { namedSql, paramObj };
}

async function all(sql, params = []) {
  await init();
  const { namedSql, paramObj } = toNamedParams(sql, params);
  const reader = params.length
    ? await connection.runAndReadAll(namedSql, paramObj)
    : await connection.runAndReadAll(namedSql);
  return reader.getRowObjectsJson();
}

async function run(sql, params = []) {
  await init();
  const { namedSql, paramObj } = toNamedParams(sql, params);
  if (params.length) {
    await connection.run(namedSql, paramObj);
  } else {
    await connection.run(namedSql);
  }
}

module.exports = { init, all, run, whereAmI };
