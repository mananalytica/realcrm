const crudRouter = require("./crud-factory");

module.exports = crudRouter("tasks", [
  "title", "description", "due_date", "status", "priority", "related_type", "related_id",
], { orderBy: "due_date ASC NULLS LAST" });
