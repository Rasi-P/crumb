# Crumb

A connected cake-business workspace for **Luna Bake Studio**, with an interactive 2D/3D Cake Studio, customer approvals, orders, production, payments, and financial operations.

## Run locally

Requires Node.js 22.13+ (verified on Node.js 26).

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
server/           Express API, owner sessions, transactional SQLite repository
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
OWNER_PASSWORD='your-own-long-password' npm start
```

Production requires `OWNER_PASSWORD`. It uses HttpOnly, SameSite cookies, expiring owner sessions, login throttling, and mutation origin checks. Serve behind HTTPS for secure cookies. Configure `HOST`, `PORT`, and `DATABASE_PATH` as needed; retain and back up the SQLite file on persistent storage.

This is a single-business installation. Multi-user signup, automated email/WhatsApp delivery, a payment gateway, and generative AI are integration points rather than active external services. Payments record manually received funds. Share links work wherever the server is reachable; localhost links are usable on the same machine. Quotation export uses the browser's PDF/print flow.

## Assets

`public/images/cake-collection.png` contains original generated product photography. See [ASSETS.md](ASSETS.md) for the prompt and provenance. DM Sans and the Three.js number-cake typeface are bundled locally.
