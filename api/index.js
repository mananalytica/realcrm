// Vercel serverless entry point
require("dotenv").config();
const serverless = require("serverless-http");
const app = require("../server-app");

module.exports = serverless(app);

// Default Vercel function timeout (10s on Hobby tier) is frequently too
// short for a cold start: DuckDB has to download and install the
// "motherduck" extension the first time it connects, which alone can take
// several seconds. Without this, cold-start requests can get silently
// killed before they ever respond - which looks like the browser just
// hanging forever, with nothing logged (since logging happens on response).
module.exports.config = { maxDuration: 60 };
