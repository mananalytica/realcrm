const crudRouter = require("./crud-factory");

module.exports = crudRouter("leads", [
  "contact_id", "status", "requirements", "lead_score",
]);
