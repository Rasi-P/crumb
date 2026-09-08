import { loadState } from "../server/database";
import { PostgresRepository } from "../server/storage/postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const cloud = new PostgresRepository(
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
);
try {
  const existing = await cloud.read();
  if (existing.revision !== 0)
    throw new Error(
      "The hosted workspace already has changes. Migration stopped without overwriting them.",
    );
  const local = loadState();
  const saved = await cloud.mutate(() => ({ ...local, revision: 1 }), 0);
  console.log(
    `Migrated ${saved.customers.length} customers, ${saved.orders.length} orders, ${saved.designs.length} designs and their related records to Postgres.`,
  );
} finally {
  await cloud.close();
}
