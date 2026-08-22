const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const router = express.Router();

// Optional shared-secret protection. If LEAD_WEBHOOK_SECRET is set in the
// environment, every request must include a matching ?key= (or x-webhook-key
// header) or it's rejected. If unset, the endpoint is open - fine for local
// testing, but set a secret before pointing real ad platforms at your
// production URL so randoms can't spam your contacts table.
function checkSecret(req, res, next) {
  const configured = process.env.LEAD_WEBHOOK_SECRET;
  if (!configured) return next();
  const provided = req.query.key || req.headers["x-webhook-key"];
  if (provided !== configured) return res.status(401).json({ error: "Invalid or missing webhook key" });
  next();
}

// Accepts a wide variety of field-name spellings so this can be pointed at
// directly by Zapier/Make/Pabbly "Webhook" actions without the user needing
// to rename fields on their end - just map whatever's convenient.
function pickField(body, ...names) {
  for (const n of names) {
    if (body[n] !== undefined && body[n] !== null && String(body[n]).trim() !== "") return String(body[n]).trim();
  }
  return null;
}

function normalizeLead(body) {
  const first = pickField(body, "first_name", "firstName");
  const last = pickField(body, "last_name", "lastName");
  const name =
    pickField(body, "name", "full_name", "fullName") ||
    [first, last].filter(Boolean).join(" ") ||
    null;

  return {
    name,
    phone: pickField(body, "phone", "phone_number", "phoneNumber", "mobile", "contact_number"),
    whatsapp: pickField(body, "whatsapp", "whatsapp_number"),
    email: pickField(body, "email", "email_address"),
    city: pickField(body, "city"),
    requirements: pickField(body, "message", "requirements", "comments", "notes", "inquiry", "ad_name", "campaign_name"),
  };
}

// POST /api/v1/webhooks/lead?source=facebook|google|website|zameen|olx|other&key=<secret>
// Generic catch-all for any no-code connector (Zapier, Make, Pabbly) or a
// website form's own fetch() call. Creates a contact + a linked lead.
router.post("/lead", checkSecret, async (req, res) => {
  try {
    const body = req.body || {};
    const lead = normalizeLead(body);
    if (!lead.name && !lead.phone && !lead.email) {
      return res.status(400).json({ error: "Payload needs at least a name, phone, or email" });
    }
    const source = (req.query.source || body.source || "Website").toString();

    const contactId = uuidv4();
    await db.run(
      `INSERT INTO contacts (id, contact_type, name, phone, whatsapp, email, city, purpose, lead_source, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [contactId, "buyer", lead.name || "Unknown", lead.phone, lead.whatsapp, lead.email, lead.city, "buy", source, lead.requirements]
    );

    const leadId = uuidv4();
    await db.run(
      `INSERT INTO leads (id, contact_id, status, requirements, lead_score) VALUES (?, ?, ?, ?, ?)`,
      [leadId, contactId, "new", lead.requirements, 20]
    );

    res.status(201).json({ contact_id: contactId, lead_id: leadId, source });
  } catch (err) {
    res.status(500).json({ error: "Webhook processing failed: " + err.message });
  }
});

// ---------- Google Ads Lead Form native webhook ----------
// Google's Lead Form asset supports a direct webhook integration (configured
// in Google Ads under Assets > Lead form > Webhook), which sends a fixed
// JSON schema (not customizable) and requires a verification handshake:
// Google first sends a GET with ?google_key=... which the endpoint must
// echo back to prove ownership before it will start sending real leads.
router.get("/google-leads", (req, res) => {
  const googleKey = req.query.google_key;
  if (!googleKey) return res.status(400).send("Missing google_key");
  // Echo it straight back - this is Google's documented verification step.
  res.status(200).send(googleKey);
});

router.post("/google-leads", async (req, res) => {
  try {
    const body = req.body || {};
    const configuredKey = process.env.GOOGLE_LEAD_FORM_KEY;
    if (configuredKey && body.google_key !== configuredKey) {
      return res.status(401).json({ error: "google_key mismatch" });
    }

    const columns = {};
    (body.user_column_data || []).forEach((col) => {
      columns[col.column_id] = col.string_value;
    });

    const name = columns.FULL_NAME || [columns.FIRST_NAME, columns.LAST_NAME].filter(Boolean).join(" ") || null;
    const phone = columns.PHONE_NUMBER || null;
    const email = columns.EMAIL || null;
    const city = columns.CITY || null;

    if (!name && !phone && !email) {
      // Still 200 - Google expects success responses even for test pings
      // (body.is_test === true); just skip creating a record.
      return res.status(200).json({ ok: true, skipped: true });
    }

    const contactId = uuidv4();
    await db.run(
      `INSERT INTO contacts (id, contact_type, name, phone, email, city, purpose, lead_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [contactId, "buyer", name || "Unknown", phone, email, city, "buy", "Google Ads Lead Form"]
    );
    const leadId = uuidv4();
    await db.run(
      `INSERT INTO leads (id, contact_id, status, lead_score) VALUES (?, ?, ?, ?)`,
      [leadId, contactId, "new", 20]
    );

    res.status(200).json({ ok: true, contact_id: contactId, lead_id: leadId });
  } catch (err) {
    // Google retries on non-2xx, so log server-side but still ack receipt
    // to avoid repeated retries hammering a broken payload.
    console.error("Google lead form webhook error:", err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
});

module.exports = router;
