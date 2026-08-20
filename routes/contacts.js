const crudRouter = require("./crud-factory");

module.exports = crudRouter("contacts", [
  "contact_type", "name", "phone", "whatsapp", "email", "cnic", "city", "address",
  "budget_min", "budget_max", "preferred_areas", "preferred_size_unit", "preferred_size_value",
  "purpose", "lead_source", "notes",
]);
