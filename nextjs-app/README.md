# Nitte FPC Inventory — Next.js + Drizzle + PostgreSQL

The same inventory & barcode-label system as the PHP version, with the same screens and behaviour,
rebuilt on **Next.js 16**, **Drizzle ORM** and **PostgreSQL**. It runs locally with Node.js and can be
deployed to **Cloudflare Workers** without code changes.

The old PHP app (one folder up) is untouched, so both can run side by side while you switch over.

---

## 1. Run it locally

You need Node.js 20.9+ and PostgreSQL (already installed: PostgreSQL 18).

```bash
cd nextjs-app
npm install

# 1. Create an empty database (enter your postgres password when asked)
"C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres nfpc_inventory

# 2. Settings: open .env and put your PostgreSQL password into DATABASE_URL
#    DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/nfpc_inventory

# 3. Create the tables and default data (roles, categories, label template)
npm run db:setup
#    (optional) add the 12 sample products too:  npm run db:seed:samples

# 4. Start
npm run dev          # development, http://localhost:3000
# or
npm run build && npm start   # production mode
```

**No PostgreSQL password handy?** Use a private database just for this app instead of steps 1–2:
`npm run localdb:init` (once; stores it in `.pgdata/`, port 5433, and writes `DATABASE_URL` to `.env`).
After a restart of the computer, run `npm run localdb:start` before `npm start`.

Open <http://localhost:3000>. The first time, the sign-in page asks you to create the Super Admin
account (exactly as before). To let other computers on the network use it, run
`npm start -- -H 0.0.0.0` and set `APP_URL` in `.env` (e.g. `http://192.168.1.20:3000`).

## 2. Bring over your existing data from MySQL (optional)

Copies every product, stock movement, user, role, label template, reset request and activity-log
entry, keeping their IDs. **Everyone keeps their username and password**: old PHP password hashes are
accepted and upgraded automatically at each person's next sign-in.

1. Start MySQL in XAMPP, and open the old PHP app once (so its database is on the latest version).
2. Check `MYSQL_URL` in `.env` (pre-filled from the old `db.php`).
3. On a freshly created database:

```bash
npm run db:migrate
npm run import:mysql -- --yes     # replaces everything in the PostgreSQL database
```

Don't run `db:seed` before the import (the import brings your own roles, categories and templates).

## Automatic SKUs

New products get a SKU (barcode value) automatically, and it can always be edited: type your own
SKU in the form, or click **Generate** to go back to an automatic one. Managers set the format with
the gear button next to the SKU field (**SKU format**): pick a style or write your own, using
`{PREFIX}` (company code), `{CAT}` (category code), `{NAME:4}`, `{SEQ:5}` (running number that never
repeats), `{RAND:5}` (random digits) and `{YYYY}` `{YY}` `{MM}` `{DD}`. Bulk-upload rows without a SKU
use the same format. SKUs are made on the server, so two people adding products at once never get
the same one.

## Printing labels on a barcode / label printer

Works with thermal label printers that have a Windows driver: Zebra, TSC, TVS, Godex, Xprinter, Honeywell, and others.

1. **Install the printer's Windows driver**, and in the driver's printing preferences set the
   paper/stock size to your label size (e.g. 50 × 25 mm), with the label gap/mark sensor as your roll needs.
2. In the app: **Inventory → Label templates → Printer & label size**
   - *Print on:* **Barcode / label printer (roll)**
   - *Label size:* your roll (or *Custom size…*), *Labels across the roll* for 2-up / 3-up rolls
   - *Label layout:* **Full label** (100 × 75 mm and up), **Compact** (≈ 50 × 25 to 75 × 50 mm) or
     **Barcode + price only** (smallest labels)
   - *Black only:* on for thermal printers
   The preview shows the label at its real shape, and warns if the barcode bars would be thinner than
   0.25 mm (too thin for many 203 dpi printers). Shorter SKUs or a larger label fix that.
3. **Print** (from a product's *Label* button, the selection bar, or *Export → Print labels*). In the
   print dialog choose the label printer, **Margins: None**, **Scale: 100% / Default**, and turn off
   *Headers and footers*. Each label is sent as its own page at the exact label size, so the printer
   feeds exactly one label per label.

**One-click printing (no print dialog):** make the label printer Windows' *default printer*, then open
the app from a Chrome shortcut with the `--kiosk-printing` switch, e.g.
`"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing http://localhost:3000`
(close all other Chrome windows first). Print then goes straight to the printer. Microsoft Edge
accepts the same switch.

The *Normal printer (A4 sheet)* option keeps the previous behaviour: several labels per A4 page.

## 3. Deploy to Cloudflare

The app is built for Cloudflare Workers with [OpenNext](https://opennext.js.org/cloudflare). Nothing
in the code depends on the server's filesystem: sessions live in the database, passwords use Web Crypto,
and the database driver works on Workers.

1. **A PostgreSQL database reachable from the internet**, e.g. [Neon](https://neon.tech),
   [Supabase](https://supabase.com) or your own server. Create the tables from your computer:
   ```bash
   # with DATABASE_URL in .env pointing at the hosted database
   npm run db:setup            # or db:migrate + import:mysql to bring your data
   ```
2. **Connect the Worker to it.** Recommended: [Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
   (connection pooling near the database):
   ```bash
   npx wrangler login
   npx wrangler hyperdrive create nfpc-db --connection-string="postgres://USER:PASS@HOST:5432/DB"
   ```
   Paste the printed id into the `hyperdrive` block in `wrangler.jsonc` and uncomment it.
   Or, without Hyperdrive: `npx wrangler secret put DATABASE_URL`.
3. **Settings:** set `APP_URL` (your public address, used in emailed links) in `wrangler.jsonc` → `vars`.
   For email on Cloudflare use [Resend](https://resend.com): set `MAIL_TRANSPORT` to `resend` and `MAIL_FROM` in `vars`, then
   `npx wrangler secret put RESEND_API_KEY`. (SMTP/Gmail is for local or Node.js hosting.)
4. **Deploy:**
   ```bash
   npm run cf:deploy
   ```
   The Cloudflare build sets your local `.env` aside while it runs (and puts it back), because
   OpenNext would otherwise copy it — passwords included — into the uploaded Worker. On Cloudflare,
   settings come only from `wrangler.jsonc` `vars` and `npx wrangler secret put NAME`.
   Run this on Linux, macOS, WSL or in CI. On plain Windows the OpenNext build needs
   *Developer Mode* turned on (it creates symlinks). `npm run cf:preview` runs the Worker locally first.

Workers paid plan is recommended: password checks need more CPU than the free plan's 10 ms limit.

## Settings (`.env`)

| Name | What it does |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Public address of the app, used in password-reset emails. Blank = the address in the browser (only trusted for `localhost`). |
| `MAIL_TRANSPORT` | `none` (reset requests go to Users & roles → Reset requests), `smtp` or `resend` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | SMTP server (Gmail: use an App password) |
| `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` | Resend / sender details |
| `MYSQL_URL` | Old MySQL database, only for `npm run import:mysql` |

## Commands

| Command | |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop / build / run in production mode |
| `npm run db:setup` | Create tables + default data (`db:migrate` then `db:seed`) |
| `npm run db:seed:samples` | Default data plus 12 sample products |
| `npm run db:generate` | After editing `src/db/schema.ts`: create a new migration in `src/db/migrations` |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run import:mysql -- --yes` | Copy all data from the old MySQL database |
| `npm run cf:preview` / `cf:deploy` | Run on the local Workers runtime / deploy to Cloudflare |
| `npm run typecheck` | TypeScript check |

## How it's organised

```
src/
  db/schema.ts            database tables (Drizzle) — the single source of truth for the schema
  db/migrations/          SQL migrations generated from schema.ts
  db/seed.ts              default roles, categories, label template (+ sample products)
  lib/auth.ts             signed-in user, permissions, impersonation, activity log, password resets
  lib/context.ts          per-request context and database-backed sessions
  lib/api/*.ts            the JSON API: inventory, users & roles, dashboard & activity
  app/api/route.ts        /api?action=… (same protocol as the old api.php)
  app/auth/*/route.ts     sign-in, forgot / reset password and account form posts
  app/<page>/page.tsx     pages: login, forgot, reset, account, dashboard, inventory, activity, users
public/
  assets/                 shared CSS, JS, logos (from the PHP version)
  js/                     each page's browser script (from the PHP version, URLs updated)
scripts/import-mysql.ts   MySQL → PostgreSQL data copy
```

Every page footer credits the developer, [Inspirante Technologies Pvt. Ltd.](https://inspirantech.in/), next to the "© year … All rights reserved." notice
(set in `src/lib/config.ts`).

The page markup and browser scripts are carried over from the PHP version unchanged apart from URLs
(`api.php` → `/api`, `users.php` → `/users`, …), which is why the screens look and work the same.
Old addresses such as `dashboard.php` or reset links `reset.php?token=…` redirect to the new ones.

### Speed

- **Pages draw immediately:** each page's first data is embedded in the HTML, and page scripts
  start as soon as the HTML arrives (not after React loads).
- **Inventory is paged on the server:** search, category, stock filters, counts and paging run in
  PostgreSQL, so only one page of products (25–200) is ever sent. "Export", "Print all" and the ZIP
  download fetch the full list only when clicked. The activity log is paged the same way.
- **Fewer database trips:** the session and signed-in user load in one query; categories are
  cached for a minute; a product edit locks, reads and writes in one statement; dashboard and
  activity queries run in parallel; PostgreSQL builds the product JSON itself.
- **Smaller, cached transfers:** API responses are gzip-compressed (Cloudflare compresses on its
  own), and CSS/JS/images are cached by the browser for a year with a new `?v=` on every build.
- **Indexes for every list and search** (see below), including trigram indexes so "contains"
  searches stay fast as the inventory and activity log grow.

### Database changes from MySQL

- Usernames, emails, SKUs and names are case-insensitive (`citext`), just as MySQL's collation was.
- Units, stock actions and log categories are real enums; role permissions are a `text[]`; label
  templates and change lists are `jsonb`.
- Checks keep bad data out: stock and MRP can't be negative, best-before can't be before packing.
- `stock_movements.qty_change` is calculated by the database.
- Indexes match the queries the app runs: newest-first lists, sign-in rate limits, activity filters,
  pending resets, a covering index for the stock-movement chart, and `pg_trgm` trigram indexes for
  the stock-list and activity-log search boxes. At most one label template can be the default.
- Frequently updated tables (products, sessions, users) keep free space in each page, so updates
  happen in place (HOT) instead of rewriting index entries.
- Sessions are stored in the `sessions` table (only a hash of the cookie is kept).
- The unused report views `v_low_stock` / `v_expiring_soon` were dropped; the dashboard computes these.
