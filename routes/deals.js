const crudRouter = require("./crud-factory");

module.exports = crudRouter("deals", [
  "property_id", "buyer_contact_id", "seller_contact_id", "deal_type", "stage",
  "token_amount", "token_date", "token_expiry", "refund_conditions", "witness_cnics",
  "commission_percentage", "commission_amount", "expected_close_date", "actual_close_date", "notes",
]);
