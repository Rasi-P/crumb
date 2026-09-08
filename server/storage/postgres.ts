import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { stateSchema, type AppState } from "../../src/domain/models";
import { createSeed } from "../../src/domain/seed";
import { StateConflict, type StateRepository } from "./types";

const simple = [
  "customers",
  "designs",
  "inventory",
  "expenses",
  "notifications",
] as const;
const related = ["products", "orders", "payments", "quotes"] as const;
const tables = [...simple, ...related];
const foreignKeys: Record<string, string[]> = {
  products: ["designId"],
  orders: ["customerId", "designId"],
  payments: ["orderId"],
  quotes: ["customerId", "designId", "orderId"],
};
const readSql = `SELECT jsonb_build_object(
  'business', data, 'revision', revision,
  ${tables.map((table) => `'${table}', COALESCE((SELECT jsonb_agg(data ORDER BY position) FROM crumb_${table}), '[]'::jsonb)`).join(",")}
) AS state FROM crumb_business WHERE id = 'luna'`;

export class PostgresRepository implements StateRepository {
  private readonly pool: Pool;
  private initialized?: Promise<void>;
  constructor(connectionString: string) {
    const url = new URL(connectionString);
    if (
      ["require", "prefer", "verify-ca"].includes(
        url.searchParams.get("sslmode") || "",
      )
    )
      url.searchParams.set("sslmode", "verify-full");
    this.pool = new Pool({
      connectionString: url.toString(),
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
      allowExitOnIdle: true,
    });
    if (process.env.VERCEL) attachDatabasePool(this.pool);
    this.pool.on("error", () =>
      console.error("The idle database connection closed."),
    );
  }
  private ensureInitialized() {
    if (!this.initialized)
      this.initialized = this.initialize().catch((error) => {
        this.initialized = undefined;
        throw error;
      });
    return this.initialized;
  }
  private async initialize() {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize first-run setup across independent serverless instances.
      await client.query("SELECT pg_advisory_xact_lock(1840719001)");
      await client.query(`
        CREATE TABLE IF NOT EXISTS crumb_business (id TEXT PRIMARY KEY, data JSONB NOT NULL, revision INTEGER NOT NULL);
        ${simple.map((table) => `CREATE TABLE IF NOT EXISTS crumb_${table} (id TEXT PRIMARY KEY, data JSONB NOT NULL, position INTEGER NOT NULL);`).join("\n")}
        CREATE TABLE IF NOT EXISTS crumb_products (id TEXT PRIMARY KEY, data JSONB NOT NULL, position INTEGER NOT NULL, "designId" TEXT NOT NULL REFERENCES crumb_designs(id));
        CREATE TABLE IF NOT EXISTS crumb_orders (id TEXT PRIMARY KEY, data JSONB NOT NULL, position INTEGER NOT NULL, "customerId" TEXT NOT NULL REFERENCES crumb_customers(id), "designId" TEXT NOT NULL REFERENCES crumb_designs(id));
        CREATE TABLE IF NOT EXISTS crumb_payments (id TEXT PRIMARY KEY, data JSONB NOT NULL, position INTEGER NOT NULL, "orderId" TEXT NOT NULL REFERENCES crumb_orders(id));
        CREATE TABLE IF NOT EXISTS crumb_quotes (id TEXT PRIMARY KEY, data JSONB NOT NULL, position INTEGER NOT NULL, "customerId" TEXT NOT NULL REFERENCES crumb_customers(id), "designId" TEXT NOT NULL REFERENCES crumb_designs(id), "orderId" TEXT REFERENCES crumb_orders(id));
        CREATE TABLE IF NOT EXISTS crumb_login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL);
      `);
      const existing = await client.query(
        "SELECT id FROM crumb_business WHERE id = 'luna'",
      );
      if (!existing.rowCount) await this.persist(client, createSeed());
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  private async persist(client: PoolClient, raw: AppState) {
    const state = stateSchema.parse(raw);
    await client.query(
      ["quotes", "payments", "orders", "products", ...simple]
        .map((table) => `DELETE FROM crumb_${table}`)
        .join(";"),
    );
    await client.query(
      `INSERT INTO crumb_business (id, data, revision) VALUES ('luna', $1::jsonb, $2)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, revision = EXCLUDED.revision`,
      [JSON.stringify(state.business), state.revision],
    );
    for (const table of tables) {
      const keys = foreignKeys[table] || [];
      await client.query(
        `INSERT INTO crumb_${table} (id, data, position${keys.map((key) => `, "${key}"`).join("")})
        SELECT item->>'id', item, ord-1${keys.map((key) => `, item->>'${key}'`).join("")}
        FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS entries(item, ord)`,
        [JSON.stringify(state[table])],
      );
    }
  }
  async read() {
    await this.ensureInitialized();
    const result = await this.pool.query(readSql);
    return stateSchema.parse(result.rows[0].state);
  }
  async mutate(update: (state: AppState) => AppState, revision?: number) {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT id FROM crumb_business WHERE id = 'luna' FOR UPDATE",
      );
      const result = await client.query(readSql);
      const current = stateSchema.parse(result.rows[0].state);
      if (revision !== undefined && current.revision !== revision)
        throw new StateConflict(current);
      const next = stateSchema.parse(update(current));
      if (next.revision !== current.revision + 1)
        throw new Error(
          "A workspace update must advance its revision exactly once.",
        );
      await this.persist(client, next);
      await client.query("COMMIT");
      return next;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async consumeLoginAttempt(key: string) {
    await this.ensureInitialized();
    const now = Date.now();
    await this.pool.query(
      "DELETE FROM crumb_login_attempts WHERE expires < $1",
      [now],
    );
    const result = await this.pool.query(
      `INSERT INTO crumb_login_attempts (key, count, expires) VALUES ($1, 1, $2)
      ON CONFLICT (key) DO UPDATE SET count = crumb_login_attempts.count + 1 RETURNING count`,
      [key, now + 900000],
    );
    return result.rows[0].count <= 10;
  }
  close() {
    return this.pool.end();
  }
}
