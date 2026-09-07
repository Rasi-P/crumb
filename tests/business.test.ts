import { describe, expect, it } from "vitest";
import { createSeed, defaultCake } from "../src/domain/seed";
import {
  calculatePrice,
  balance,
  businessMetrics,
  recipeFor,
  costRecipe,
} from "../src/domain/pricing";
import { applyCommand, canTransition } from "../src/domain/commands";
import {
  cakeSchema,
  stateSchema,
  dateOffset,
  today,
  type Payment,
} from "../src/domain/models";
import { applyDesignOperations } from "../src/domain/designOperations";

describe("Live costing and stable commercial snapshots", () => {
  it("uses inventory unit costs when pricing ingredients", () => {
    const s = createSeed();
    const cake = defaultCake();
    const before = calculatePrice(cake, 35, s.inventory);
    s.inventory.find((i) => i.name === "Unsalted butter")!.cost *= 2;
    expect(calculatePrice(cake, 35, s.inventory).cost).toBeGreaterThan(
      before.cost,
    );
    expect(
      costRecipe(cake, s.inventory).find((i) => i.name === "Unsalted butter")!
        .unitCost,
    ).toBe(1120);
  });
  it("does not expense inventory purchases a second time", () => {
    const s = createSeed();
    const before = businessMetrics(s, today(), today());
    s.expenses.push({
      id: "stock-purchase",
      date: today(),
      description: "Flour restock",
      category: "Ingredients",
      amount: 5000,
      note: "",
    });
    expect(businessMetrics(s, today(), today()).netProfit).toBe(
      before.netProfit,
    );
    s.expenses.push({
      id: "marketing",
      date: today(),
      description: "Local promotion",
      category: "Marketing",
      amount: 500,
      note: "",
    });
    expect(businessMetrics(s, today(), today()).netProfit).toBe(
      before.netProfit - 500,
    );
  });
  it("freezes a quotation's agreed selling price", () => {
    const s = createSeed();
    const quote = {
      ...s.quotes[0],
      id: "quoted",
      token: "quoted",
      status: "Sent" as const,
      orderId: null,
      config: { ...defaultCake(), sellingPrice: null },
    };
    const next = applyCommand(s, { type: "quote.save", value: quote });
    const saved = next.quotes.find((q) => q.id === "quoted")!;
    expect(saved.config.sellingPrice).not.toBeNull();
    next.inventory.forEach((i) => (i.cost *= 2));
    expect(calculatePrice(saved.config, 70, next.inventory).total).toBe(
      saved.total,
    );
  });
  it("excludes collected tax from recognized sales", () => {
    const s = createSeed();
    s.orders = [
      {
        ...s.orders[0],
        status: "Completed",
        date: today(),
        total: 4400,
        config: { ...defaultCake(), sellingPrice: 4000, delivery: 0, tax: 10 },
      },
    ];
    expect(businessMetrics(s, today(), today()).revenue).toBe(4000);
  });
  it("validates AI-ready operations without mutating the source design", () => {
    const original = defaultCake();
    const next = applyDesignOperations(original, [
      { type: "setColor", tierId: original.tiers[0].id, color: "#abcdef" },
      {
        type: "addDecoration",
        tierId: original.tiers[0].id,
        decoration: "Macarons",
      },
    ]);
    expect(next.tiers[0].color).toBe("#abcdef");
    expect(original.tiers[0].color).not.toBe("#abcdef");
    expect(() =>
      applyDesignOperations(original, [
        { type: "setColor", tierId: "missing", color: "#abcdef" },
      ]),
    ).toThrow("no longer exists");
  });
});

describe("Structured designs and seed relationships", () => {
  it("validates all seeded entities and minimum demo counts", () => {
    const s = stateSchema.parse(createSeed());
    expect(s.customers.length).toBeGreaterThanOrEqual(15);
    expect(s.orders.length).toBeGreaterThanOrEqual(20);
    expect(s.designs.length).toBeGreaterThanOrEqual(15);
    expect(s.products.length).toBeGreaterThanOrEqual(10);
    expect(s.inventory.length).toBeGreaterThanOrEqual(20);
    expect(s.expenses.length).toBeGreaterThanOrEqual(15);
  });
  it("connects every order, product and payment to a real entity", () => {
    const s = createSeed();
    for (const o of s.orders) {
      expect(s.customers.some((c) => c.id === o.customerId)).toBe(true);
      expect(s.designs.some((d) => d.id === o.designId)).toBe(true);
    }
    for (const p of s.payments)
      expect(s.orders.some((o) => o.id === p.orderId)).toBe(true);
    for (const p of s.products)
      expect(s.designs.some((d) => d.id === p.designId)).toBe(true);
  });
  it("round-trips a cake without losing decorations or pricing", () => {
    const cake = defaultCake();
    expect(cakeSchema.parse(JSON.parse(JSON.stringify(cake)))).toEqual(cake);
  });
  it("rejects invalid tiers, unsafe colors and non-finite prices", () => {
    expect(cakeSchema.safeParse({ ...defaultCake(), tiers: [] }).success).toBe(
      false,
    );
    expect(
      cakeSchema.safeParse({
        ...defaultCake(),
        textColor: "url(javascript:alert(1))",
      }).success,
    ).toBe(false);
    expect(
      cakeSchema.safeParse({ ...defaultCake(), sellingPrice: Infinity })
        .success,
    ).toBe(false);
  });
  it("keeps the Aisha demonstration coherent", () => {
    const s = createSeed();
    const o = s.orders.find((o) => o.number === 1048)!;
    expect(s.customers.find((c) => c.id === o.customerId)?.name).toBe(
      "Aisha Rahman",
    );
    expect(o.total).toBe(3800);
    expect(balance(o, s.payments)).toMatchObject({
      paid: 1500,
      remaining: 2300,
    });
    expect(o.config.tiers.map((t) => t.diameter)).toEqual([8, 6]);
    expect(s.quotes.find((q) => q.orderId === o.id)?.status).toBe("Approved");
  });
});
describe("Pricing and business calculations", () => {
  it("keeps every production cost line accounted for", () => {
    const p = calculatePrice(defaultCake());
    expect(p.cost).toBe(p.lines.reduce((n, l) => n + l.amount, 0));
    expect(p.total).toBe(3800);
    expect(p.profit).toBe(p.selling - p.cost);
  });
  it("recalculates the price when tiers, flavor, and decorations change", () => {
    const config = defaultCake();
    config.sellingPrice = null;
    const base = calculatePrice(config);
    const extra = structuredClone(config);
    extra.tiers.push({ ...extra.tiers[1], id: "extra", diameter: 4 });
    expect(calculatePrice(extra).cost).toBeGreaterThan(base.cost);
    expect(
      calculatePrice({ ...config, flavor: "Chocolate" }).cost,
    ).toBeGreaterThan(base.cost);
    extra.tiers[0].decorations.push("Macarons");
    expect(calculatePrice(extra).total).toBeGreaterThan(base.total);
  });
  it("applies delivery and discounts before tax", () => {
    const p = calculatePrice({
      ...defaultCake(),
      sellingPrice: 4000,
      delivery: 200,
      discount: 500,
      tax: 10,
    });
    expect(p.subtotal).toBe(3700);
    expect(p.tax).toBe(370);
    expect(p.total).toBe(4070);
  });
  it("preserves explicit zero price and reports a loss honestly", () => {
    const p = calculatePrice({
      ...defaultCake(),
      sellingPrice: 0,
      delivery: 0,
    });
    expect(p.selling).toBe(0);
    expect(p.total).toBe(0);
    expect(p.profit).toBe(-p.cost);
    expect(p.margin).toBe(0);
  });
  it("increases the suggested selling price with target margin", () => {
    const config = { ...defaultCake(), sellingPrice: null };
    expect(calculatePrice(config, 50).suggested).toBeGreaterThan(
      calculatePrice(config, 25).suggested,
    );
  });
  it("scales ingredient quantities by volume and rounds eggs upwards", () => {
    const cake = defaultCake();
    cake.tiers = [{ ...cake.tiers[0], diameter: 8, height: 4 }];
    const recipe = recipeFor(cake);
    expect(recipe.find((i) => i.name === "All-purpose flour")?.quantity).toBe(
      0.4,
    );
    expect(recipe.find((i) => i.name === "Eggs")?.quantity).toBe(5);
    cake.tiers[0].height = 8;
    expect(recipeFor(cake).find((i) => i.name === "Eggs")?.quantity).toBe(10);
  });
  it("recognizes revenue on completion rather than order creation or advance", () => {
    const s = createSeed();
    const o = s.orders[0];
    const before = businessMetrics(s, today(), today());
    const after = businessMetrics(
      applyCommand(s, {
        type: "order.status",
        id: o.id,
        status: "Completed",
        consume: false,
      }),
      today(),
      today(),
    );
    expect(after.revenue - before.revenue).toBe(o.total);
    expect(after.grossProfit - before.grossProfit).toBe(o.total - o.cost);
  });
  it("respects date boundaries and reports zero average with no sales", () => {
    const s = createSeed();
    const m = businessMetrics(s, dateOffset(300), dateOffset(301));
    expect(m.revenue).toBe(0);
    expect(m.average).toBe(0);
    expect(m.margin).toBe(0);
  });
});
describe("Payments and order integrity", () => {
  const payment = (
    amount: number,
    kind: Payment["kind"] = "Payment",
  ): Payment => ({
    id: "test-payment",
    orderId: "order-1048",
    amount,
    kind,
    method: "UPI",
    date: today(),
    reference: "TEST",
  });
  it("updates balances and communication together without changing the input", () => {
    const s = createSeed();
    const next = applyCommand(s, { type: "payment.add", value: payment(2300) });
    expect(balance(next.orders[0], next.payments)).toMatchObject({
      remaining: 0,
      status: "Paid",
    });
    expect(balance(s.orders[0], s.payments).remaining).toBe(2300);
    expect(next.orders[0].activity[0].text).toContain("2,300");
  });
  it("rejects overpayments and refunds above the received amount", () => {
    expect(() =>
      applyCommand(createSeed(), { type: "payment.add", value: payment(2301) }),
    ).toThrow("exceeds");
    expect(() =>
      applyCommand(createSeed(), {
        type: "payment.add",
        value: payment(1501, "Refund"),
      }),
    ).toThrow("exceeds");
  });
  it("is idempotent when a payment id is submitted twice", () => {
    const once = applyCommand(createSeed(), {
      type: "payment.add",
      value: payment(100),
    });
    const twice = applyCommand(once, {
      type: "payment.add",
      value: payment(100),
    });
    expect(balance(twice.orders[0], twice.payments).paid).toBe(1600);
  });
  it("records refunds without losing transaction history", () => {
    const next = applyCommand(createSeed(), {
      type: "payment.add",
      value: payment(500, "Refund"),
    });
    expect(balance(next.orders[0], next.payments).paid).toBe(1000);
    expect(
      next.payments.filter((p) => p.orderId === "order-1048"),
    ).toHaveLength(2);
  });
  it("requires a refund before cancellation and receipt before paid status", () => {
    expect(() =>
      applyCommand(createSeed(), {
        type: "order.status",
        id: "order-1048",
        status: "Cancelled",
      }),
    ).toThrow("Refund");
    expect(() =>
      applyCommand(createSeed(), {
        type: "order.status",
        id: "order-1048",
        status: "Paid",
      }),
    ).toThrow("remaining payment");
  });
  it("does not reopen completed or cancelled orders", () => {
    expect(canTransition("Completed", "Baking")).toBe(false);
    expect(canTransition("Cancelled", "Confirmed")).toBe(false);
    expect(() =>
      applyCommand(createSeed(), {
        type: "order.status",
        id: "order-1038",
        status: "Baking",
      }),
    ).toThrow("closed");
  });
  it("rejects dangling customer and design relationships", () => {
    const s = createSeed();
    expect(() =>
      applyCommand(s, {
        type: "order.save",
        value: { ...s.orders[0], id: "new", customerId: "missing" },
      }),
    ).toThrow("Customer");
    expect(() =>
      applyCommand(s, {
        type: "product.save",
        value: { ...s.products[0], designId: "missing" },
      }),
    ).toThrow("Design");
  });
  it("assigns order numbers and calculates trusted server totals", () => {
    const s = createSeed();
    const o = { ...s.orders[0], id: "new-order", number: 5, total: 1, cost: 1 };
    const n = applyCommand(s, { type: "order.save", value: o });
    const created = n.orders.find((x) => x.id === o.id)!;
    expect(created.number).toBe(1049);
    expect(created.total).toBe(3800);
    expect(created.cost).toBe(calculatePrice(o.config).cost);
  });
  it("prevents reducing an order below payments already received", () => {
    const s = createSeed();
    const o = {
      ...s.orders[0],
      config: { ...s.orders[0].config, sellingPrice: 100, delivery: 0 },
    };
    expect(() => applyCommand(s, { type: "order.save", value: o })).toThrow(
      "refund",
    );
  });
});
describe("Pantry and customer approval transactions", () => {
  it("deducts all recipe ingredients and marks the order in one update", () => {
    const s = createSeed();
    const n = applyCommand(s, {
      type: "order.status",
      id: s.orders[0].id,
      status: "Completed",
      consume: true,
    });
    for (const r of recipeFor(s.orders[0].config)) {
      const before = s.inventory.find((i) => i.name === r.name)!;
      const after = n.inventory.find((i) => i.name === r.name)!;
      expect(after.stock).toBeCloseTo(before.stock - r.quantity, 3);
      expect(after.history[0].reason).toBe("Order #1048");
    }
    expect(n.orders[0].inventoryConsumed).toBe(true);
  });
  it("does not deduct ingredients twice for the same completion", () => {
    const s = createSeed();
    const n = applyCommand(s, {
      type: "order.status",
      id: s.orders[0].id,
      status: "Completed",
      consume: true,
    });
    expect(
      applyCommand(n, {
        type: "order.status",
        id: s.orders[0].id,
        status: "Completed",
        consume: true,
      }).inventory,
    ).toEqual(n.inventory);
  });
  it("rejects shortages atomically and preserves all balances", () => {
    const s = createSeed();
    s.inventory.find((i) => i.name === "Eggs")!.stock = 0;
    const original = structuredClone(s);
    expect(() =>
      applyCommand(s, {
        type: "order.status",
        id: s.orders[0].id,
        status: "Completed",
        consume: true,
      }),
    ).toThrow("Not enough eggs");
    expect(s).toEqual(original);
  });
  it("does not allow negative stock", () => {
    expect(() =>
      applyCommand(createSeed(), {
        type: "inventory.adjust",
        id: "item-1",
        quantity: -999,
        reason: "Correction",
      }),
    ).toThrow("negative");
  });
  it("validates empty change requests and expiry", () => {
    const s = createSeed();
    s.quotes[0].status = "Sent";
    expect(() =>
      applyCommand(s, {
        type: "quote.respond",
        token: s.quotes[0].token,
        status: "Changes Requested",
        request: "",
      }),
    ).toThrow("describe");
    s.quotes[0].validUntil = dateOffset(-1);
    expect(() =>
      applyCommand(s, {
        type: "quote.respond",
        token: s.quotes[0].token,
        status: "Approved",
        request: "",
      }),
    ).toThrow("expired");
  });
  it("adds requested changes to the linked order timeline", () => {
    const s = createSeed();
    s.quotes[0].status = "Sent";
    const n = applyCommand(s, {
      type: "quote.respond",
      token: s.quotes[0].token,
      status: "Changes Requested",
      request: "Ivory roses, please",
    });
    expect(n.quotes[0].status).toBe("Changes Requested");
    expect(n.orders[0].activity[0].text).toContain("Ivory roses, please");
  });
  it("approves an outstanding quotation and confirms its order", () => {
    const s = createSeed();
    s.quotes[0].status = "Sent";
    s.orders[0].status = "Quotation Sent";
    const n = applyCommand(s, {
      type: "quote.respond",
      token: s.quotes[0].token,
      status: "Approved",
      request: "",
    });
    expect(n.quotes[0].status).toBe("Approved");
    expect(n.orders[0].status).toBe("Confirmed");
  });
  it("does not downgrade an approval when the customer revisits", () => {
    const s = createSeed();
    expect(
      applyCommand(s, {
        type: "quote.respond",
        token: s.quotes[0].token,
        status: "Viewed",
        request: "",
      }).quotes[0].status,
    ).toBe("Approved");
  });
});
