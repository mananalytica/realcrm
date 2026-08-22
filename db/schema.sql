-- Pakistani Real Estate CRM schema (DuckDB / MotherDuck compatible)

CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR PRIMARY KEY,
    contact_type VARCHAR NOT NULL,          -- buyer, seller, landlord, tenant, investor, owner
    name VARCHAR NOT NULL,
    phone VARCHAR,
    whatsapp VARCHAR,
    email VARCHAR,
    cnic VARCHAR,
    city VARCHAR,
    address VARCHAR,
    budget_min DOUBLE,
    budget_max DOUBLE,
    preferred_areas VARCHAR,                -- comma separated
    preferred_size_unit VARCHAR,            -- Marla, Kanal, Sq Ft, Sq Yd
    preferred_size_value DOUBLE,
    purpose VARCHAR,                        -- buy, sell, rent, invest
    lead_source VARCHAR,                    -- Zameen, OLX, Facebook, referral, walk-in
    notes VARCHAR,
    created_at TIMESTAMP DEFAULT current_timestamp,
    updated_at TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS properties (
    id VARCHAR PRIMARY KEY,
    property_type VARCHAR NOT NULL,         -- residential_plot, house, apartment, commercial, agricultural, file
    purpose VARCHAR NOT NULL,               -- sale, rent
    size_unit VARCHAR,                      -- Marla, Kanal, Sq Ft, Sq Yd
    size_value DOUBLE,
    city VARCHAR,
    area VARCHAR,
    society VARCHAR,
    phase VARCHAR,
    block VARCHAR,
    plot_number VARCHAR,
    file_number VARCHAR,
    file_type VARCHAR,                      -- open, closed, ballot, transfer
    payment_plan_status VARCHAR,
    transfer_fee_status VARCHAR,
    asking_price DOUBLE,
    rent_price DOUBLE,
    dc_rate DOUBLE,
    market_rate DOUBLE,
    development_charges_status VARCHAR,     -- pending, paid
    possession_status VARCHAR,              -- file_only, under_development, possession_ready, constructed
    verification_status VARCHAR,            -- not_verified, fard_checked, noc_verified, registry_pending, transfer_complete
    description VARCHAR,
    image_urls VARCHAR,                     -- comma separated
    status VARCHAR DEFAULT 'available',     -- available, token_taken, sold, rented, suspended
    owner_contact_id VARCHAR,
    created_at TIMESTAMP DEFAULT current_timestamp,
    updated_at TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR PRIMARY KEY,
    contact_id VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'new',           -- new, qualified, unqualified, converted
    requirements VARCHAR,
    lead_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT current_timestamp,
    updated_at TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR PRIMARY KEY,
    property_id VARCHAR,
    buyer_contact_id VARCHAR,
    seller_contact_id VARCHAR,
    deal_type VARCHAR,                      -- sale, rent
    stage VARCHAR DEFAULT 'new_inquiry',
    token_amount DOUBLE,
    token_date DATE,
    token_expiry DATE,
    refund_conditions VARCHAR,
    witness_cnics VARCHAR,
    commission_percentage DOUBLE DEFAULT 2.0,
    commission_amount DOUBLE,
    expected_close_date DATE,
    actual_close_date DATE,
    notes VARCHAR,
    created_at TIMESTAMP DEFAULT current_timestamp,
    updated_at TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    description VARCHAR,
    due_date TIMESTAMP,
    status VARCHAR DEFAULT 'pending',       -- pending, in_progress, completed, cancelled
    priority VARCHAR DEFAULT 'medium',      -- low, medium, high, urgent
    related_type VARCHAR,                   -- contact, property, deal
    related_id VARCHAR,
    created_at TIMESTAMP DEFAULT current_timestamp,
    updated_at TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR PRIMARY KEY,
    doc_type VARCHAR,                       -- cnic, fard, registry, noc, transfer_letter, tax_receipt, affidavit, token_receipt
    file_url VARCHAR,
    related_type VARCHAR,                   -- contact, property, deal
    related_id VARCHAR,
    verification_status VARCHAR DEFAULT 'unverified',
    verified_by VARCHAR,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS financials (
    id VARCHAR PRIMARY KEY,
    entry_type VARCHAR NOT NULL,            -- income, expense, token_held
    category VARCHAR,                       -- commission, marketing, fuel, other
    amount DOUBLE NOT NULL,
    deal_id VARCHAR,
    description VARCHAR,
    entry_date DATE DEFAULT current_date,
    created_at TIMESTAMP DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR PRIMARY KEY,
    invoice_number VARCHAR,
    deal_id VARCHAR,
    contact_id VARCHAR,                     -- who the invoice is billed to
    description VARCHAR,                    -- e.g. "Commission - sale of DHA Phase 6 house"
    subtotal DOUBLE,                        -- gross commission/fee amount (PKR)
    tax_label VARCHAR,                      -- e.g. "Withholding Tax (Filer, 12%) - Sec. 233"
    tax_rate DOUBLE DEFAULT 0,              -- percentage, e.g. 12 or 24
    tax_amount DOUBLE DEFAULT 0,
    net_total DOUBLE,                       -- subtotal - tax_amount = amount actually payable
    currency VARCHAR DEFAULT 'PKR',
    issue_date DATE,
    due_date DATE,
    scheduled_send_at TIMESTAMP,            -- when the agent plans to send this
    status VARCHAR DEFAULT 'draft',         -- draft, scheduled, sent, paid, overdue, cancelled
    sent_at TIMESTAMP,
    paid_at TIMESTAMP,
    notes VARCHAR,
    created_at TIMESTAMP DEFAULT current_timestamp,
    updated_at TIMESTAMP DEFAULT current_timestamp
);

-- Single-row table holding the agency's own business profile, used as the
-- letterhead/footer on generated invoice PDFs.
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR PRIMARY KEY DEFAULT 'default',
    business_name VARCHAR,
    owner_name VARCHAR,
    address VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    ntn VARCHAR,
    strn VARCHAR,
    bank_details VARCHAR,                   -- bank account and/or JazzCash/Easypaisa details
    invoice_footer_note VARCHAR,
    next_invoice_seq INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR PRIMARY KEY,
    contact_id VARCHAR,
    direction VARCHAR,                      -- inbound, outbound
    content VARCHAR,
    ai_handled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT current_timestamp
);
