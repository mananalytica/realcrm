/**
 * Column definitions used by the CSV import endpoint. Keeps the importer
 * from accepting arbitrary table/column names (SQL-injection guard) and
 * tells it which fields need to be parsed as numbers vs. left as strings.
 */

const TABLES = {
  contacts: {
    columns: ["contact_type", "name", "phone", "whatsapp", "email", "cnic", "city", "address",
      "budget_min", "budget_max", "preferred_areas", "preferred_size_unit", "preferred_size_value",
      "purpose", "lead_source", "notes", "created_at"],
    numeric: ["budget_min", "budget_max", "preferred_size_value"],
    required: ["name", "contact_type"],
  },
  properties: {
    columns: ["property_type", "purpose", "size_unit", "size_value", "city", "area", "society", "phase",
      "block", "plot_number", "file_number", "file_type", "payment_plan_status", "transfer_fee_status",
      "asking_price", "rent_price", "dc_rate", "market_rate", "development_charges_status",
      "possession_status", "verification_status", "description", "image_urls", "status",
      "owner_contact_id", "created_at"],
    numeric: ["size_value", "asking_price", "rent_price", "dc_rate", "market_rate"],
    required: ["property_type", "purpose"],
  },
  leads: {
    columns: ["contact_id", "status", "requirements", "lead_score", "created_at"],
    numeric: ["lead_score"],
    required: ["contact_id"],
  },
  deals: {
    columns: ["property_id", "buyer_contact_id", "seller_contact_id", "deal_type", "stage", "token_amount",
      "token_date", "token_expiry", "refund_conditions", "witness_cnics", "commission_percentage",
      "commission_amount", "expected_close_date", "actual_close_date", "notes", "created_at"],
    numeric: ["token_amount", "commission_percentage", "commission_amount"],
    required: [],
  },
  tasks: {
    columns: ["title", "description", "due_date", "status", "priority", "related_type", "related_id", "created_at"],
    numeric: [],
    required: ["title"],
  },
  documents: {
    columns: ["doc_type", "file_url", "related_type", "related_id", "verification_status", "verified_by",
      "expiry_date", "created_at"],
    numeric: [],
    required: [],
  },
  financials: {
    columns: ["entry_type", "category", "amount", "deal_id", "description", "entry_date", "created_at"],
    numeric: ["amount"],
    required: ["entry_type", "amount"],
  },
};

module.exports = { TABLES };
