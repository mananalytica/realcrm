const crudRouter = require("./crud-factory");

module.exports = crudRouter("properties", [
  "property_type", "purpose", "size_unit", "size_value", "city", "area", "society", "phase",
  "block", "plot_number", "file_number", "file_type", "payment_plan_status", "transfer_fee_status",
  "asking_price", "rent_price", "dc_rate", "market_rate", "development_charges_status",
  "possession_status", "verification_status", "description", "image_urls", "status", "owner_contact_id",
]);
