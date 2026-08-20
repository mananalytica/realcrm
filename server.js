require("dotenv").config();
const app = require("./server-app");
const db = require("./db");

const PORT = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Pak Real Estate CRM running at http://localhost:${PORT}`);
      console.log(`Mode: ${process.env.MOTHERDUCK_TOKEN ? "MotherDuck" : "Local DuckDB file"}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
