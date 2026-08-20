const crudRouter = require("./crud-factory");

module.exports = crudRouter("financials", [
  "entry_type", "category", "amount", "deal_id", "description", "entry_date",
], { hasUpdatedAt: false, orderBy: "entry_date DESC" });
