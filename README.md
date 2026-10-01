# Crumb

A connected cake-business workspace for **Luna Bake Studio**, with an interactive 2D/3D Cake Studio, customer approvals, orders, production, payments, and financial operations.

## Run locally

Use Node.js 24 LTS, the configured Vercel runtime. Local development is also verified on Node.js 26.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. If occupied, the server picks the next available port and prints its URL. Development mode opens directly into the local owner's workspace.

The database is created at `.data/crumb.sqlite` on first run. It includes 16 customers, 36 orders, 17 structured designs, 12 products, 22 inventory items, 16 expenses, payments, and quotations. Seed dates are relative to first run. Data persists across restarts.

## Connected journey

1. Add a customer in Customers or the new-order flow.
2. Choose a Studio template. Customize shape, tiers, dimensions, frosting, decorations, lettering, and flavor.
3. Inspect the live 3D cake using orbit, zoom, and preset views. Check production costs and override the selling price in Pricing.
4. Save or let autosave finish. Generate a quotation for the customer.
5. Open the customer link in a separate tab. Approve or request changes.
6. In Catalog > Quotations, create an order from the approved quote.
7. Record an advance. Move the order through production.
8. Complete delivery, optionally recording ingredient consumption. Revenue and profit appear in Analytics, while any remaining balance stays visible.

Aisha's seeded order is `/orders/order-1048`, its editable design is `/studio/design-aisha`, and its customer quotation is `/q/luna-aisha-floral-2026`. The agreed total is INR 3,800, with an INR 1,500 advance and INR 2,300 remaining.

## Included

- Dashboard, date filters, production agenda, upcoming cakes, revenue, favorites, and inventory alerts.
- Searchable/filterable orders, order editing, five-step creation, production drag-and-drop and accessible stage selects.
- Customer creation, editing, preferences, notes, order history, and revenue.
- Catalog, saved designs, favorites, templates, drafts, archiving, duplication, and product editing.
- Month/week/day calendars, inventory adjustments and history, expense creation/editing and CSV export.
- Serializable cake configuration, separate SVG and Three.js renderers, dynamic pricing, undo/redo, autosave, and keyboard shortcuts.
- Public token-based quotations, frozen price snapshots, expiry, approval, and change requests.
- Business profile, logo upload, pricing preferences, taxes, delivery, notification preferences, light/dark themes, and data export.
- Mobile navigation and Studio property sheets, accessible dialogs, focus states, toasts, loading and error recovery.

## Architecture

```text
src/domain/       Zod models, pricing, recipes, calculations, commands, seed data
src/lib/          Typed client store and serialized API mutations
src/components/   Shared controls, layout, charts, dialogs, and search
src/pages/        Business workflows and public quotations
src/studio/       Editor, 2D SVG renderer, lazy-loaded Three.js renderer
server/           Express API, signed owner sessions, SQLite/Postgres repositories
api/              Vercel Function entry point
tests/            Business tests, browser workflows, visual/accessibility audits
```

Database foreign keys enforce customer/order/design/payment relationships. Server-validated mutations commit atomically. Revision checks reject stale writes. Payment IDs prevent duplicate receipts; ingredient consumption is idempotent. Closed orders cannot be silently reopened or overwritten.

`applyDesignOperations` is a validated, deterministic extension point for future AI adapters. Inspiration images remain separate from production models.

## Calculation conventions

- Production cost includes scaled recipe ingredients at pantry unit costs, kitchen time, frosting, structure, finishing, decorations, lettering, and packaging.
- Suggested prices use the configured gross margin. Manual overrides take precedence. Delivery and discounts apply before tax.
- Orders and quotations freeze agreed selling prices. Orders retain their production-cost snapshot when pantry costs change.
- Revenue is recognized on completed orders and excludes collected tax. Payments independently track receipts, refunds, and balances.
- Net profit subtracts production costs and operating expenses. Ingredient, packaging, and decoration purchases stay visible in the expense ledger but are excluded from operating expenses because consumed materials already appear in production cost.
- Recipes are practical baseline estimates. Completing with ingredient recording checks every stock balance before deducting anything.

## Verify

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use installed Google Chrome and an isolated database/server on port 5180. They cover the complete customer-to-delivery journey, stock and expenses, 3D canvas pixels, view and shape changes, mobile layouts, and stale writes.

With the main server running:

```sh
node --import tsx tests/visual-audit.ts
node --import tsx tests/accessibility-audit.ts
```

Screenshots are written to `.artifacts/`.

## Production build

```sh
npm run build
OWNER_PASSWORD='your-own-long-password' SESSION_SECRET='your-own-random-secret-at-least-32-characters' npm start
```

Production requires `OWNER_PASSWORD` (at least 16 characters) and `SESSION_SECRET` (at least 32 characters). It uses HttpOnly, SameSite, Secure cookies and signed 24-hour sessions that work across server instances. Changing either secret invalidates existing sessions. Login throttling is stored in the database, and mutation requests check their origin. Sign out from Settings > Account.

For a standalone server, serve behind HTTPS. Configure `HOST`, `PORT`, and `DATABASE_PATH` as needed; retain and back up the SQLite file on persistent storage.

## Image-to-3D for Cake Studio

"Create from Cake Image" sends the photograph to an image-to-3D service and uses the GLB it returns as the cake. Set one key on the server; nothing is generated, and no stand-in cake is shown, without it:

```sh
# .env in the project root (read by `npm run dev` and `npm start`), or real environment variables
MESHY_API_KEY=...        # https://www.meshy.ai — or TRIPO_API_KEY=... for Tripo
```

`IMAGE_TO_3D_PROVIDER=meshy|tripo` chooses between them when both keys are present. The other optional settings are listed in `.env.example`. Confirm a key works, at the cost of one generation, with:

```sh
npm run studio:image-to-3d-smoke -- path/to/cake.jpg
```

Generated models and reference photographs are stored in `.data/studio-assets` locally and in the `crumb_studio_assets` Postgres table when `DATABASE_URL` is set. See `src/studio/README.md` for the pipeline and its current limits, including what has and has not been exercised against a live provider.

## Vercel deployment

Live application: **https://crumb-cake-os.vercel.app**. Sign in using `OWNER_PASSWORD` from the private `.env.deployment.local` file on the setup machine.

The linked project is `rasikkaas-projects/crumb-cake-os`. Vercel serves the Vite assets from `dist/` and routes `/api/*` to the Express Function. `npm run build` also bundles the TypeScript backend into `.server-build/app.mjs`, loaded by the small JavaScript entry at `api/index.js`. This avoids runtime TypeScript and extensionless ESM import resolution. The function and the free Neon Postgres database are configured in Singapore (`sin1`).

Required server-side production variables:

- `DATABASE_URL`: injected by the Neon integration.
- `OWNER_PASSWORD`: generated and stored as a sensitive Vercel variable.
- `SESSION_SECRET`: generated and stored as a sensitive Vercel variable.

The initial owner credentials are in the git-ignored, owner-readable `.env.deployment.local` file on the setup machine. These files are excluded from deployment uploads. Never prefix secrets with `VITE_`.

```sh
npx vercel --prod --scope rasikkaas-projects
```

The initial deployment was published from the local working tree. Commit the deployment configuration and backend changes before relying on automatic Git-based redeployments. No secrets or database files belong in Git.

Postgres retains the same entities and foreign-key relationships as SQLite. Each mutation locks the workspace row, checks its revision, and commits all related changes in one transaction. Local SQLite remains the default when `DATABASE_URL` is absent; Vercel refuses to fall back to ephemeral SQLite.

`scripts/migrate-to-postgres.ts` transfers the existing local workspace only into an untouched hosted workspace. It refuses to overwrite hosted changes. `tests/postgres.integration.ts` verifies cross-instance persistence, concurrent revision conflicts, foreign-key rollback, and shared login throttling. Both require `DATABASE_URL` and can use a git-ignored env file:

```sh
node --env-file=.env.vercel.local --import tsx tests/postgres.integration.ts
```

The live-site verification is reproducible with `node --import tsx tests/deployed-check.ts https://crumb-cake-os.vercel.app`. It checks owner authentication, a non-destructive save, quotation privacy, deep links, 3D pixels, mobile controls, and logout. It reads the owner password locally without printing it.

Only production is connected to the live database. Before enabling preview deployments, provision a separate preview database and authentication secrets; do not point experimental previews at production data.

This is a single-business installation. Multi-user signup, automated email/WhatsApp delivery, a payment gateway, and generative AI are integration points rather than active external services. Payments record manually received funds. Share links work wherever the server is reachable; localhost links are usable on the same machine. Quotation export uses the browser's PDF/print flow.

## Assets

`public/images/cake-collection.png` contains original generated product photography. See [ASSETS.md](ASSETS.md) for the prompt and provenance. DM Sans and the Three.js number-cake typeface are bundled locally.
