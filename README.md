# Kaghazi CRM — Pakistani Real Estate CRM (Solo Agent)

A single-agent CRM for the Pakistani property market: contacts, listings (plots,
houses, apartments, commercial, agricultural, and plot **files**), leads, a
deal pipeline (with token/bayana tracking), tasks, documents, and a simple
financial ledger.

## Stack

- **Backend:** Node.js + Express, plain REST JSON API
- **Database:** DuckDB — a local file for development, [MotherDuck](https://motherduck.com)
  (DuckDB's managed cloud service) for production. Same code, same SQL, just
  swap one environment variable.
- **Frontend:** Static HTML + vanilla JS + a custom stylesheet (no build step)
- **Deploy target:** Vercel (serverless functions + static hosting)

## Run it locally (no MotherDuck account needed)

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. That's it — on first run the app creates a
DuckDB file at `./data/crm.duckdb` and builds all the tables automatically.
Everything you enter persists there between restarts. Delete that file (or
the whole `data/` folder) any time to start over with an empty database.

No `.env` file is required for local testing. Copy `.env.example` to `.env`
only if you want to change the port or the local DB file path.

### Import data via CSV (works on Vercel too — no shell access needed)

Open **Import Data** in the sidebar. Pick a table, choose a CSV file, and
upload. This hits `/api/v1/import/:table` under the hood, so it works
identically whether you're running locally or on your deployed Vercel URL —
useful for loading data into a MotherDuck-backed production database without
needing a terminal.

Notes:
- CSV headers must match the table's column names (the Import page shows the
  expected columns once you pick a table).
- An `id` column is optional — include one if you want rows in one file to
  reference rows in another (e.g. a deal's `buyer_contact_id` matching a
  contact's `id`). Omit it and one is generated automatically.
- Check "Replace existing data in this table" to clear the table before
  importing, or leave it unchecked to append.
- If you're loading a full related dataset, upload in this order: **Contacts
  → Properties → Leads → Deals → Tasks → Financials** (each later file can
  reference IDs from the ones before it).

To generate your own sample CSVs (e.g. a smaller batch, or a different
random sample) instead of using the pre-generated ones:

```bash
node scripts/export-csv.js ./sample-data 1000
```

The second argument is the base contact count — everything else (properties,
leads, deals, tasks, financials) scales proportionally with the same
realistic conversion-funnel shape described below. Files land in
`./sample-data/` by default.

### Connecting lead sources (Facebook, Google, website, property portals)

Two webhook endpoints exist for automated lead capture:

```
POST /api/v1/webhooks/lead?source=<name>&key=<secret>
```
A flexible catch-all. Accepts a JSON body with common field-name variants
(`name`/`full_name`, `phone`/`phone_number`, `email`, `message`/`requirements`,
etc.) and creates a contact + linked lead in one call. Point any no-code
connector (Zapier, Make, Pabbly) at this.

```
GET/POST /api/v1/webhooks/google-leads
```
Matches Google's native Lead Form webhook schema exactly (no Zapier needed).
`GET` handles Google's setup verification handshake; `POST` receives real
leads. Set `GOOGLE_LEAD_FORM_KEY` in your env to validate Google's
`google_key` field.

Set `LEAD_WEBHOOK_SECRET` in your environment to require a `?key=` (or
`x-webhook-key` header) on the generic endpoint — do this before pointing
real ad platforms at your production URL, or anyone who finds the URL could
spam your contacts table.

### Invoicing (Pakistani commission invoices)

**Business Profile** (sidebar) — fill this in once: agency name, NTN, address,
bank/JazzCash/Easypaisa details. It's the letterhead on every invoice PDF.

**Invoices** (sidebar) — create standalone, or click "Generate Invoice →"
inside a closed deal in the Pipeline (auto-fills the buyer and commission
amount). Each invoice shows:
- **Gross Commission** → **Less: Withholding Tax** → **Net Amount Payable** —
  matching how Pakistani commission actually works: under Section 233 of the
  Income Tax Ordinance, the client withholds tax at source and deposits it to
  FBR against your NTN, so you receive the *net* figure. Presets for Filer
  (12%) and Non-Filer (24%) are built in, or set a custom rate.
- **Download** — generates a PDF on the fly (`GET /api/v1/invoices/:id/pdf`).
- **Forward via WhatsApp** — opens a `wa.me` click-to-chat link with a
  pre-filled message and a link to the invoice PDF, and marks the invoice as
  sent. This works today with zero API setup; when you wire up the WhatsApp
  Business API later, `GET /api/v1/invoices/:id/whatsapp-link` already
  returns the message text + PDF URL in a shape you can reuse for
  programmatic sending instead of the manual click-to-chat flow.
- **Scheduling** — set a future "Schedule to send on" date/time and the
  invoice's status becomes `scheduled`. There's no automatic dispatch yet
  (that needs the WhatsApp Business API), so treat it as a due-list: check
  the Invoices page for anything sitting in `scheduled` status that's due.
- **Mark Paid** — one click, records `paid_at`.

### Load sample data straight into the database (no CSV, no Vercel)

Want to see the dashboard fully populated on a *local* run instead of
starting from zero?

```bash
npm run seed
```

This wipes existing data and generates:
- **10,000 contacts** — realistic Pakistani names, phone numbers, cities
  (weighted toward Lahore/Karachi/Islamabad), societies (DHA, Bahria Town,
  Gulberg, etc.), and lead sources (Zameen, OLX, Facebook, WhatsApp, referral)
- **3,000 properties** across all types and cities
- **~5,700 leads** from buyer/tenant/investor-type contacts
- **1,500 deals** spread across all 12 pipeline stages
- **~900 tasks** (site visits, follow-ups — some overdue, some upcoming)
- **~500 financial entries** (commissions, token money held, marketing/fuel expenses)

The conversion funnel is tuned to real-world real-estate benchmarks:
**~26% of leads become an active deal**, and **~7% of deals close won** —
netting roughly **1.7–2% overall lead-to-close**, which is a realistic range
for a solo agent working mixed cold/warm inbound leads. Re-run `npm run seed`
any time to regenerate a fresh random dataset.

`npm run seed` writes directly to whatever database is configured
(`MOTHERDUCK_TOKEN` set → MotherDuck; otherwise the local file) — same
switch as running the app itself. If you don't have terminal access to your
Vercel deployment's environment, use the CSV import method above instead.

## Project structure

```
server.js         Local dev entry point (starts the HTTP server)
server-app.js      The actual Express app (shared by local + Vercel)
api/index.js        Vercel serverless entry point, wraps server-app.js
db/schema.sql      All table definitions
db/index.js        DB connection + query helpers (switches local <-> MotherDuck)
db/generators.js   Shared synthetic-data generator (used by seed + CSV export)
db/table-configs.js Column whitelist/types for CSV import
db/seed.js         Writes the generator's output straight into the DB
scripts/export-csv.js  Writes the generator's output as CSV files instead
routes/            One file per module (contacts, properties, leads, deals,
                    tasks, documents, financials, dashboard, import) + a
                    shared CRUD-router factory so each module stays a few lines
public/            Static frontend (one HTML page per module, shared css/js)
```

## Switching to MotherDuck (for production / shared cloud data)

1. Create a free account at [motherduck.com](https://motherduck.com) and grab
   a service token from Settings → Tokens.
2. Set two environment variables (in `.env` locally, or in Vercel's project
   settings for deployment):
   ```
   MOTHERDUCK_TOKEN=<your token>
   MOTHERDUCK_DATABASE=pak_crm
   ```
3. That's the whole change. The app attaches to `md:pak_crm` instead of the
   local file and creates the same tables there on first boot.

**Note on transactionality:** MotherDuck is an OLAP (analytical) database, not
a traditional transactional one. This app avoids multi-table transactions and
relies on simple single-row inserts/updates, which is a good fit for a
solo-agent CRM's write volume. It is not built for many concurrent writers.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. In Project Settings → Environment Variables, add `MOTHERDUCK_TOKEN` and
   `MOTHERDUCK_DATABASE` (see above).
4. Deploy. `vercel.json` is already configured to route `/api/*` to the
   serverless function and everything else to the static `public/` folder.

**File uploads on Vercel:** the `/api/v1/documents-upload` route currently
saves to local disk, which works for local testing but is ephemeral on
Vercel's serverless filesystem (files vanish between invocations). Before
relying on document uploads in production, swap `routes/upload.js` for
Vercel Blob, S3, or Cloudinary and store the returned URL in `file_url` —
the rest of the Documents module doesn't care where the file physically lives.

### Troubleshooting: `/api/v1/health` hangs, or data doesn't show up in MotherDuck

DuckDB has to download and install the "motherduck" extension from
`extensions.duckdb.org` the first time it connects on a cold start. Vercel's
default function timeout is only 10 seconds, which is often not enough.

**Important:** this project's `vercel.json` uses Vercel's modern zero-config
format (`"functions"` + `"rewrites"`) specifically because their older
`"builds"`/`"routes"` format **does not reliably support `maxDuration`** —
Vercel's own docs state the two are mutually exclusive, and mixing them
either gets silently ignored or fails the deployment outright. If you're
customizing `vercel.json`, keep it in this format:

```json
{
  "functions": { "api/index.js": { "maxDuration": 60 } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
```

If you still hit timeouts after deploying this version:

1. Hit `/api/v1/health` — it reports `mode`, `configuredDatabase`,
   `connectedDatabase` (queried live), and row counts per table. Compare
   `connectedDatabase` to what you see in the MotherDuck UI.
2. If `mode` says `"local-duckdb"` instead of `"motherduck"`, your
   `MOTHERDUCK_TOKEN` isn't reaching the deployed function — check:
   - It's set for the **Production** environment specifically in Vercel's
     Environment Variables (not just Preview/Development).
   - You **redeployed after setting it** — Vercel doesn't apply new/changed
     env vars to existing deployments.
3. Check Vercel's **Runtime Logs** (not build/deployment logs) for the
   `/api/v1/health` invocation specifically — a timeout or connection error
   will show a specific message there on this version, instead of a bare
   504 with no detail.
4. Every write endpoint (creating a contact, importing a CSV, etc.) shares
   the same database connection logic, so if one hangs, they all will —
   this isn't specific to any one feature.

## What's implemented vs. what's stubbed

**Implemented and tested:**
- Full CRUD for Contacts, Properties, Leads, Deals, Tasks, Documents, Financials
- Dashboard with live aggregates (pipeline value, leads today, site visits,
  commissions this month, tasks due soon) and recent-activity lists
- Deal pipeline as a Kanban board across all 12 stages
- File upload for documents (local disk in dev, needs a cloud store for prod)
- Pakistan-specific fields throughout: Marla/Kanal/Sq Ft/Sq Yd sizing, society/
  phase/block/plot/file numbers, DC rate, verification checklist stages, CNIC

**Intentionally left as a follow-up (marked optional in the original spec):**
- WhatsApp AI integration (Twilio + GPT webhook, auto lead qualification) —
  this needs your own Twilio/OpenAI credentials and a public webhook URL, so
  it wasn't wired up by default. The `messages` table is already in the
  schema, ready for it.
- Automated cron reminders (follow-up nudges, document expiry alerts) — same
  reasoning; add via Vercel Cron once you're deployed and want this live.
- Auth — this is a single-user tool by design; add a login layer before
  exposing it on the public internet if that changes.

## API reference

Base path: `/api/v1`. Every module (`contacts`, `properties`, `leads`,
`deals`, `tasks`, `documents`, `financials`) supports:

```
GET    /api/v1/<module>          list (supports simple ?field=value filters)
GET    /api/v1/<module>/:id      get one
POST   /api/v1/<module>          create
PUT    /api/v1/<module>/:id      update
DELETE /api/v1/<module>/:id      delete
```

Plus:
```
GET  /api/v1/dashboard           aggregated dashboard data
POST /api/v1/documents-upload    multipart file upload, returns { file_url }
GET  /api/v1/import/tables       lists importable tables + expected CSV columns
POST /api/v1/import/:table       multipart CSV upload; field "file", optional field "replace"="true"
GET  /api/v1/health              { ok, mode: "local-duckdb" | "motherduck" }
```
