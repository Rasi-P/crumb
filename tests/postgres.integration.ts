import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresRepository } from "../server/storage/postgres";
import { StateConflict } from "../server/storage/types";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const first = new PostgresRepository(process.env.DATABASE_URL);
const second = new PostgresRepository(process.env.DATABASE_URL);
try {
  const before = await first.read();
  assert.ok(before.customers.length >= 16);
  const increment = (state: typeof before) => ({
    ...state,
    revision: state.revision + 1,
  });
  const results = await Promise.allSettled([
    first.mutate(increment, before.revision),
    second.mutate(increment, before.revision),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof StateConflict);
  const after = await second.read();
  assert.deepEqual({ ...after, revision: before.revision }, before);
  assert.equal(after.revision, before.revision + 1);
  console.log(
    "PASS: Separate instances share durable records and reject concurrent stale writes.",
  );
  await assert.rejects(
    first.mutate(
      (state) => ({
        ...state,
        revision: state.revision + 1,
        orders: state.orders.map((order, i) =>
          i ? order : { ...order, customerId: "missing-customer" },
        ),
      }),
      after.revision,
    ),
  );
  assert.deepEqual(await second.read(), after);
  console.log(
    "PASS: Foreign keys reject invalid relationships and roll back the complete transaction.",
  );
  const key = `deployment-test-${randomUUID()}`;
  for (let i = 0; i < 10; i++)
    assert.equal(await (i % 2 ? first : second).consumeLoginAttempt(key), true);
  assert.equal(await second.consumeLoginAttempt(key), false);
  console.log("PASS: Login throttling is shared across application instances.");
} finally {
  await first.close();
  await second.close();
}
