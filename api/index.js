// Vercel serverless entry point
require("dotenv").config();
const serverless = require("serverless-http");
const app = require("../server-app");

module.exports = serverless(app);
