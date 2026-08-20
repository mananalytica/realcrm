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

## Project structure

```
server.js         Local dev entry point (starts the HTTP server)
server-app.js      The actual Express app (shared by local + Vercel)
api/index.js        Vercel serverless entry point, wraps server-app.js
db/schema.sql      All table definitions
db/index.js        DB connection + query helpers (switches local <-> MotherDuck)
routes/            One file per module (contacts, properties, leads, deals,
                    tasks, documents, financials, dashboard) + a shared
                    CRUD-router factory so each module stays a few lines
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
GET  /api/v1/health              { ok, mode: "local-duckdb" | "motherduck" }
```
