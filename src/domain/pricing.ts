import type { AppState, CakeConfig, Order } from "./models";

export const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const flavorFactor: Record<string, number> = {
  Vanilla: 1,
  Chocolate: 1.18,
  "Red Velvet": 1.22,
  Lemon: 1.08,
  Strawberry: 1.2,
  "Salted Caramel": 1.25,
  Pistachio: 1.4,
};
const decorationCosts: Record<string, number> = {
  Roses: 180,
  Flowers: 150,
  Pearls: 65,
  Macarons: 220,
  Chocolate: 130,
  Fruit: 140,
  Sprinkles: 40,
  Ribbons: 45,
  Characters: 300,
  Leaves: 45,
  "Gold accents": 110,
};
const referenceUnitCosts: Record<string, number> = {
  "All-purpose flour": 65,
  "Caster sugar": 52,
  Eggs: 8,
  "Unsalted butter": 560,
  "Whipping cream": 240,
  "Dark chocolate": 650,
  "Cocoa powder": 850,
};
export function costRecipe(
  config: CakeConfig,
  inventory: AppState["inventory"] = [],
) {
  return recipeFor(config).map((item) => {
    const stock = inventory.find(
      (i) => i.name === item.name && i.unit === item.unit,
    );
    const unitCost = stock?.cost ?? referenceUnitCosts[item.name] ?? 0;
    return {
      ...item,
      unitCost,
      cost: Math.round(item.quantity * unitCost * 100) / 100,
    };
  });
}
export function calculatePrice(
  config: CakeConfig,
  targetMargin = 35,
  inventory: AppState["inventory"] = [],
) {
  const scale = config.tiers.reduce(
    (n, t) => n + ((t.diameter / 8) ** 2 * t.height) / 4,
    0,
  );
  const base = Math.round(
    costRecipe(config, inventory).reduce((n, i) => n + i.cost, 0),
  );
  const labor = Math.round(348 * scale * (flavorFactor[config.flavor] || 1));
  const frosting = Math.round(
    config.tiers.reduce(
      (n, t) =>
        n +
        ({ Buttercream: 170, Fondant: 260, Ganache: 220, "Whipped Cream": 130 }[
          t.frosting
        ] *
          t.diameter) /
          8,
      0,
    ),
  );
  const structure = (config.tiers.length - 1) * 180;
  const finish = config.tiers.reduce(
    (n, t) =>
      n +
      {
        Smooth: 0,
        Textured: 60,
        Vintage: 180,
        Minimal: 0,
        Ruffled: 150,
        Drip: 120,
        Rough: 75,
        "Semi-naked": 40,
        Naked: 0,
        Piped: 180,
      }[t.finish],
    0,
  );
  const decor =
    config.sceneVersion === 2
      ? (config.objects || []).reduce(
          (sum, object) => sum + object.unitPrice,
          0,
        )
      : config.tiers.reduce(
          (n, t) =>
            n + t.decorations.reduce((a, d) => a + decorationCosts[d], 0),
          0,
        );
  const topper = config.topper ? 160 : 0;
  const text = config.text ? 60 : 0;
  const lines = [
    { label: `${config.flavor} ingredients`, amount: base },
    { label: "Kitchen time", amount: labor },
    { label: "Frosting & filling", amount: frosting },
    { label: "Tier supports", amount: structure },
    { label: "Finishing", amount: finish },
    { label: "Decorations", amount: Math.round(decor * 100) / 100 },
    { label: "Custom topper", amount: topper },
    { label: "Lettering", amount: text },
    { label: "Board & packaging", amount: 100 },
  ].filter((l) => l.amount > 0);
  const cost = lines.reduce((n, l) => n + l.amount, 0);
  const suggested = Math.ceil(cost / (1 - targetMargin / 100) / 50) * 50;
  const selling = config.sellingPrice ?? suggested;
  const subtotal = Math.max(0, selling + config.delivery - config.discount);
  const tax = Math.round((subtotal * config.tax) / 100);
  const total = subtotal + tax;
  const profit = selling - config.discount - cost;
  return {
    lines,
    cost,
    suggested,
    selling,
    subtotal,
    tax,
    total,
    profit,
    margin:
      selling - config.discount > 0
        ? (profit / (selling - config.discount)) * 100
        : 0,
    servings: Math.round(
      config.tiers.reduce(
        (n, t) => n + (16 * (t.diameter / 8) ** 2 * t.height) / 4,
        0,
      ),
    ),
  };
}
export function balance(order: Order, payments: AppState["payments"]) {
  const paid = payments
    .filter((p) => p.orderId === order.id)
    .reduce((n, p) => n + (p.kind === "Refund" ? -p.amount : p.amount), 0);
  return {
    paid,
    remaining: Math.max(0, order.total - paid),
    status:
      paid >= order.total ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid",
  };
}
export function businessMetrics(state: AppState, from: string, to: string) {
  const orders = state.orders.filter(
    (o) => o.status !== "Cancelled" && o.date >= from && o.date <= to,
  );
  const completed = orders.filter((o) => o.status === "Completed");
  const revenue = completed.reduce((n, o) => n + orderRevenue(o), 0);
  const cost = completed.reduce((n, o) => n + o.cost, 0);
  const expenses = state.expenses
    .filter(
      (e) =>
        e.date >= from &&
        e.date <= to &&
        !["Ingredients", "Packaging", "Decorations"].includes(e.category),
    )
    .reduce((n, e) => n + e.amount, 0);
  const outstanding = orders
    .filter((o) => o.status !== "Inquiry")
    .reduce((n, o) => n + balance(o, state.payments).remaining, 0);
  return {
    revenue,
    cost,
    grossProfit: revenue - cost,
    netProfit: revenue - cost - expenses,
    expenses,
    outstanding,
    orders: orders.length,
    completed: completed.length,
    average: completed.length ? revenue / completed.length : 0,
    margin: revenue ? ((revenue - cost - expenses) / revenue) * 100 : 0,
  };
}
export const orderRevenue = (order: Order) =>
  order.total - calculatePrice(order.config).tax;
export function recipeFor(config: CakeConfig) {
  const scale = config.tiers.reduce(
    (n, t) => n + ((t.diameter / 8) ** 2 * t.height) / 4,
    0,
  );
  const ingredients = [
    { name: "All-purpose flour", quantity: 0.4, unit: "kg" },
    { name: "Caster sugar", quantity: 0.3, unit: "kg" },
    { name: "Eggs", quantity: 5, unit: "pcs" },
    { name: "Unsalted butter", quantity: 0.25, unit: "kg" },
    { name: "Whipping cream", quantity: 0.5, unit: "L" },
  ];
  if (config.flavor === "Chocolate")
    ingredients.push(
      { name: "Dark chocolate", quantity: 0.2, unit: "kg" },
      { name: "Cocoa powder", quantity: 0.06, unit: "kg" },
    );
  return ingredients.map((i) => ({
    ...i,
    quantity:
      i.unit === "pcs"
        ? Math.ceil(i.quantity * scale)
        : Math.round(i.quantity * scale * 1000) / 1000,
  }));
}
