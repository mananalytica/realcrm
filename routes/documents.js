const crudRouter = require("./crud-factory");

module.exports = crudRouter("documents", [
  "doc_type", "file_url", "related_type", "related_id", "verification_status", "verified_by", "expiry_date",
], { hasUpdatedAt: false });
