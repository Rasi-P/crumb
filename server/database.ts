import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { createSeed } from "../src/domain/seed";
import { stateSchema, type AppState } from "../src/domain/models";

mkdirSync(".data", { recursive: true });
const db = new DatabaseSync(process.env.DATABASE_PATH || ".data/crumb.sqlite");
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS business (id TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, design_id TEXT NOT NULL REFERENCES designs(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), design_id TEXT NOT NULL REFERENCES designs(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), design_id TEXT NOT NULL REFERENCES designs(id), order_id TEXT REFERENCES orders(id), data TEXT NOT NULL);`);
const simple = [
  "customers",
  "designs",
  "inventory",
  "expenses",
  "notifications",
] as const;
const related = ["products", "orders", "payments", "quotes"] as const;
export function saveState(raw: AppState) {
  const s = stateSchema.parse(raw);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of ["quotes", "payments", "orders", "products", ...simple])
      db.exec(`DELETE FROM ${table}`);
    db.prepare(
      "INSERT OR REPLACE INTO business (id,data,revision) VALUES (?,?,?)",
    ).run("luna", JSON.stringify(s.business), s.revision);
    for (const table of simple) {
      const insert = db.prepare(`INSERT INTO ${table} (id,data) VALUES (?,?)`);
      for (const row of s[table]) insert.run(row.id, JSON.stringify(row));
    }
    for (const row of s.products)
      db.prepare("INSERT INTO products VALUES (?,?,?)").run(
        row.id,
        row.designId,
        JSON.stringify(row),
      );
    for (const row of s.orders)
      db.prepare("INSERT INTO orders VALUES (?,?,?,?)").run(
        row.id,
        row.customerId,
        row.designId,
        JSON.stringify(row),
      );
    for (const row of s.payments)
      db.prepare("INSERT INTO payments VALUES (?,?,?)").run(
        row.id,
        row.orderId,
        JSON.stringify(row),
      );
    for (const row of s.quotes)
      db.prepare("INSERT INTO quotes VALUES (?,?,?,?,?)").run(
        row.id,
        row.customerId,
        row.designId,
        row.orderId,
        JSON.stringify(row),
      );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function loadState(): AppState {
  const business = db
    .prepare("SELECT data,revision FROM business WHERE id=?")
    .get("luna");
  if (!business) {
    const seed = createSeed();
    saveState(seed);
    return seed;
  }
  const result: Record<string, unknown> = {
    business: JSON.parse(business.data as string),
    revision: business.revision,
  };
  for (const table of [...simple, ...related])
    result[table] = db
      .prepare(`SELECT data FROM ${table} ORDER BY rowid`)
      .all()
      .map((row) => JSON.parse(row.data as string));
  return stateSchema.parse(result);
}
