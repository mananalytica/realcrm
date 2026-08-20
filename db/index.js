const { DuckDBInstance } = require("@duckdb/node-api");
const fs = require("fs");
const path = require("path");

// Local dev: plain DuckDB file on disk (./data/crm.duckdb)
// Production: set MOTHERDUCK_TOKEN in env and this attaches to your MotherDuck cloud DB instead.
const MD_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MD_DB_NAME = process.env.MOTHERDUCK_DATABASE || "pak_crm";
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(__dirname, "..", "data", "crm.duckdb");

let connection;
let ready;

async function init() {
  if (ready) return ready;

  ready = (async () => {
    let instance;
    if (MD_TOKEN) {
      process.env.motherduck_token = MD_TOKEN;
      instance = await DuckDBInstance.create(`md:${MD_DB_NAME}`);
    } else {
      const dataDir = path.dirname(LOCAL_DB_PATH);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      instance = await DuckDBInstance.create(LOCAL_DB_PATH);
    }
    connection = await instance.connect();
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    // DuckDB's simple protocol allows multiple ;-separated statements in one run() call
    await connection.run(schema);
  })();

  return ready;
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

module.exports = { init, all, run };
