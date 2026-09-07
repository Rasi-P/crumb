import {
  dateOffset,
  today,
  type AppState,
  type CakeConfig,
  type Design,
  type OrderStatus,
} from "./models";
import { calculatePrice } from "./pricing";

export function defaultCake(): CakeConfig {
  return {
    version: 1,
    shape: "Round",
    tiers: [
      {
        id: "tier-1",
        diameter: 8,
        height: 4,
        color: "#efd0d1",
        frosting: "Buttercream",
        finish: "Smooth",
        decorations: ["Roses", "Pearls"],
      },
      {
        id: "tier-2",
        diameter: 6,
        height: 4,
        color: "#f4dddd",
        frosting: "Buttercream",
        finish: "Smooth",
        decorations: ["Roses", "Gold accents"],
      },
    ],
    flavor: "Vanilla",
    text: "Happy Birthday Aisha",
    textColor: "#b89654",
    textStyle: "Elegant",
    textSize: 24,
    topper: "Happy Birthday",
    number: "10",
    boardColor: "#fbf8f2",
    sellingPrice: 3600,
    delivery: 200,
    discount: 0,
    tax: 0,
  };
}
const templates = [
  ["Pink Floral", 0, "Birthday", "#efd0d1", "Vanilla", "Roses", "Round", 2],
  [
    "Chocolate Luxury",
    1,
    "Birthday",
    "#52362e",
    "Chocolate",
    "Chocolate",
    "Round",
    1,
  ],
  [
    "Elegant Wedding",
    2,
    "Wedding",
    "#fff9ee",
    "Vanilla",
    "Flowers",
    "Round",
    3,
  ],
  [
    "Vintage Heart",
    3,
    "Anniversary",
    "#c5828b",
    "Red Velvet",
    "Pearls",
    "Heart",
    1,
  ],
  [
    "Minimal White Birthday",
    4,
    "Birthday",
    "#fff9f1",
    "Vanilla",
    "Flowers",
    "Round",
    1,
  ],
  [
    "Blue Baby Shower",
    5,
    "Baby Shower",
    "#b4d5e4",
    "Vanilla",
    "Characters",
    "Round",
    1,
  ],
  [
    "Black & Gold",
    6,
    "Corporate",
    "#303031",
    "Chocolate",
    "Gold accents",
    "Round",
    1,
  ],
  ["Kids Rainbow", 7, "Kids", "#eab8ce", "Strawberry", "Sprinkles", "Round", 2],
  [
    "Strawberry Cream",
    8,
    "Seasonal",
    "#fff3e8",
    "Strawberry",
    "Fruit",
    "Round",
    1,
  ],
  [
    "Classic Red Velvet",
    9,
    "Birthday",
    "#eee3d8",
    "Red Velvet",
    "Fruit",
    "Round",
    1,
  ],
  [
    "Lavender Garden",
    10,
    "Anniversary",
    "#cbb5de",
    "Lemon",
    "Flowers",
    "Round",
    1,
  ],
  [
    "Little Celebrations",
    11,
    "Cupcakes",
    "#b5c1a0",
    "Pistachio",
    "Pearls",
    "Round",
    1,
  ],
] as const;
export function createSeed(): AppState {
  const now = new Date().toISOString();
  const designs: Design[] = templates.map((t, i) => {
    const config = defaultCake();
    config.shape = t[6];
    config.flavor = t[4];
    config.text = "";
    config.topper = "";
    config.sellingPrice = null;
    config.delivery = 0;
    config.tiers = Array.from({ length: t[7] }, (_, n) => ({
      ...config.tiers[0],
      id: `tier-${n + 1}`,
      diameter: 8 - n * 2,
      color: t[3],
      decorations: [t[5]],
      finish: i === 1 ? "Drip" : i === 3 ? "Vintage" : "Smooth",
    }));
    return {
      id: `design-${i + 1}`,
      name: t[0],
      category: t[2],
      config,
      image: t[1],
      state: "Published",
      favorite: i === 0 || i === 3 || i === 10,
      template: true,
      updatedAt: dateOffset(-i),
    };
  });
  designs.push({
    id: "design-aisha",
    name: "Aisha Floral Birthday",
    category: "Birthday",
    config: defaultCake(),
    image: 0,
    state: "Saved",
    favorite: true,
    template: false,
    updatedAt: now,
  });
  designs.push(
    ...[0, 3, 10, 5].map((idx, i) => ({
      ...structuredClone(designs[idx]),
      id: `custom-${i}`,
      name: [
        "A little birthday magic",
        "For Ananya & Rohan",
        "Lavender afternoon",
        "Welcome, little one",
      ][i],
      template: false,
      state: "Draft" as const,
      updatedAt: dateOffset(-i),
    })),
  );
  const names = [
    "Aisha Rahman",
    "Rahul Mehta",
    "Maya Nair",
    "Priya Sharma",
    "Ananya Kapoor",
    "Rohan Desai",
    "Kavya Iyer",
    "Arjun Patel",
    "Neha Verma",
    "Ishaan Gupta",
    "Meera Shah",
    "Sana Khan",
    "Vikram Rao",
    "Diya Menon",
    "Ritika Joshi",
    "Aditya Bhat",
  ];
  const customers = names.map((name, i) => ({
    id: `customer-${i + 1}`,
    name,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
    phone: `+91 98${String(43051000 + i * 137).slice(0, 8)}`,
    address: [
      "24, Palm Grove Road, Indiranagar, Bengaluru",
      "18, 5th Cross, Koramangala, Bengaluru",
      "42, Lakeview Apartments, Whitefield, Bengaluru",
    ][i % 3],
    flavor: ["Vanilla", "Chocolate", "Red Velvet", "Pistachio"][i % 4],
    style: ["Floral", "Minimal", "Vintage", "Modern"][i % 4],
    colors: ["Blush pink, ivory & gold", "Chocolate & gold", "White & sage"][
      i % 3
    ],
    notes:
      i === 0
        ? "Birthday on 7 September. Loves soft pink roses. No nuts, please."
        : i === 4
          ? "Prefers eggless cakes. Anniversary in September."
          : "",
    createdAt: dateOffset(-90 - i * 4),
  }));
  const orders = Array.from({ length: 36 }, (_, i) => {
    const design =
      i === 0 ? designs[12] : designs[(i === 1 ? 1 : i === 2 ? 9 : i) % 12];
    const config = structuredClone(design.config);
    const total =
      i === 0
        ? 3800
        : [2200, 2800, 3200, 4500, 1800, 3600, 2400, 6500, 2100, 3000, 2700][
            i % 11
          ];
    config.sellingPrice = total;
    config.delivery = 0;
    const status: OrderStatus =
      i === 0
        ? "Preparing"
        : i === 1
          ? "Baking"
          : i === 2
            ? "Ready"
            : i < 10
              ? (
                  [
                    "Confirmed",
                    "Decorating",
                    "Quotation Sent",
                    "Inquiry",
                    "Preparing",
                    "Confirmed",
                    "Ready",
                  ] as const
                )[i - 3]
              : "Completed";
    const day = i < 3 ? 0 : i < 10 ? Math.ceil((i - 2) / 2) : -(i - 8);
    return {
      id: `order-${1048 - i}`,
      number: 1048 - i,
      customerId: customers[i % 16].id,
      designId: design.id,
      cakeName: i === 0 ? "2-Tier Pink Floral Birthday Cake" : design.name,
      config: i === 0 ? defaultCake() : config,
      date: dateOffset(day),
      time:
        i === 0
          ? "10:00"
          : i === 1
            ? "13:30"
            : i === 2
              ? "17:00"
              : ["11:00", "15:30", "18:00"][i % 3],
      fulfillment: i % 3 === 0 ? ("Delivery" as const) : ("Pickup" as const),
      address: customers[i % 16].address,
      status,
      total,
      cost: Math.round(total * (0.42 + (i % 5) * 0.035)),
      notes:
        i === 0
          ? "Pink roses, delicate gold pearls, and a custom birthday topper. Please keep the cake nut-free."
          : "",
      priority: i === 0 ? ("High" as const) : ("Normal" as const),
      activity: [
        {
          id: `a-${i}`,
          date: dateOffset(day - 3) + "T09:00:00",
          text: "Order confirmed. Design and delivery details agreed.",
        },
        {
          id: `a2-${i}`,
          date: dateOffset(day - 2) + "T12:30:00",
          text:
            i === 0
              ? "Advance of ₹1,500 received via UPI."
              : "Customer preferences added.",
        },
      ],
      inventoryConsumed: i >= 10,
      createdAt: dateOffset(day - 5),
    };
  });
  const payments = orders
    .filter((o) => !["Inquiry", "Quotation Sent"].includes(o.status))
    .map((o, i) => ({
      id: `payment-${i}`,
      orderId: o.id,
      amount:
        i === 0
          ? 1500
          : o.status === "Completed" || o.status === "Ready"
            ? o.total
            : Math.round(o.total / 2),
      method: "UPI" as const,
      reference: `LUNA${20260900 + i}`,
      date: o.createdAt,
      kind: "Payment" as const,
    }));
  const pantry = [
    ["All-purpose flour", "kg", 12.5, 65, 5],
    ["Caster sugar", "kg", 8, 52, 3],
    ["Eggs", "pcs", 48, 8, 20],
    ["Unsalted butter", "kg", 1.2, 560, 2],
    ["Whipping cream", "L", 1.5, 240, 3],
    ["Dark chocolate", "kg", 4.5, 650, 2],
    ["Cocoa powder", "kg", 0.35, 850, 0.5],
    ["Vanilla extract", "L", 0.4, 1200, 0.2],
    ["Icing sugar", "kg", 4, 75, 2],
    ["Cream cheese", "kg", 2.5, 720, 1],
    ["Fresh strawberries", "kg", 1.5, 320, 1],
    ["Milk", "L", 6, 60, 2],
    ["Fondant", "kg", 2, 420, 1],
    ["Baking powder", "kg", 0.8, 180, 0.2],
    ["Cake boxes", "pcs", 22, 55, 10],
    ["Cake boards", "pcs", 34, 35, 15],
    ["Satin ribbons", "m", 12, 18, 5],
    ["Paper bags", "pcs", 45, 12, 20],
    ["Birthday toppers", "pcs", 8, 80, 5],
    ["Gold sugar pearls", "g", 80, 2.5, 100],
    ["Birthday candles", "pcs", 36, 15, 12],
    ["Sugar flowers", "pcs", 24, 25, 12],
  ] as const;
  const inventory = pantry.map((p, i) => ({
    id: `item-${i + 1}`,
    name: p[0],
    unit: p[1],
    stock: p[2],
    cost: p[3],
    minimum: p[4],
    category:
      i < 14
        ? ("Ingredients" as const)
        : i < 18
          ? ("Packaging" as const)
          : ("Decorations" as const),
    history: [
      { date: dateOffset(-5), quantity: p[2], reason: "Opening balance" },
    ],
  }));
  const descriptions = [
    "Weekly pantry restock",
    "Cake boxes & boards",
    "Delivery to Indiranagar",
    "New offset spatula",
    "Sugar flowers & gold leaf",
    "September electricity",
    "Instagram promotion",
    "Cleaning supplies",
    "Fresh cream & butter",
    "Window cake boxes",
    "Weekend deliveries",
    "Digital kitchen scale",
    "Birthday toppers",
    "Kitchen electricity",
    "September photo shoot",
    "Vanilla & cocoa",
  ];
  const expenseCategories = [
    "Ingredients",
    "Packaging",
    "Delivery",
    "Equipment",
    "Decorations",
    "Electricity",
    "Marketing",
    "Other",
  ] as const;
  return {
    revision: 0,
    business: {
      name: "Luna Bake Studio",
      owner: "Sarah",
      email: "hello@lunabakestudio.com",
      phone: "+91 98450 12345",
      address: "Indiranagar, Bengaluru, Karnataka 560038",
      instagram: "@lunabakestudio",
      whatsapp: "+91 98450 12345",
      currency: "INR",
      tax: 0,
      margin: 35,
      hours: "Monday - Saturday, 9:00 AM - 6:00 PM",
      zones: "Indiranagar, Koramangala, Whitefield",
      deliveryFee: 200,
      terms:
        "A 50% advance confirms your booking. Final payment is due before delivery. Please share any allergy requirements before approval. Designs are handmade and may vary slightly.",
      notifications: true,
      theme: "Light",
      logo: "",
    },
    customers,
    designs,
    orders,
    payments,
    inventory,
    products: designs.slice(0, 12).map((d, i) => ({
      id: `product-${i + 1}`,
      designId: d.id,
      name: d.name,
      category: d.category,
      price: calculatePrice(d.config).total,
      description: [
        "Soft vanilla layers, hand-piped roses and a little touch of gold.",
        "Rich, dark chocolate sponge with silky Belgian chocolate ganache.",
        "A celebration of delicate textures and beautiful, seasonal ingredients.",
      ][i % 3],
      archived: false,
    })),
    expenses: descriptions.map((description, i) => ({
      id: `expense-${i}`,
      description,
      category: expenseCategories[i % 8],
      amount: [1450, 680, 250, 450, 520, 800, 1200, 180][i % 8],
      date: dateOffset(-i * 2),
      note: "",
    })),
    quotes: [
      {
        id: "quote-aisha",
        token: "luna-aisha-floral-2026",
        customerId: "customer-1",
        designId: "design-aisha",
        config: defaultCake(),
        name: "2-Tier Pink Floral Birthday Cake",
        total: 3800,
        date: today(),
        validUntil: dateOffset(7),
        status: "Approved",
        request: "",
        orderId: "order-1048",
      },
    ],
    notifications: [
      {
        id: "n1",
        title: "A lovely design, approved",
        text: "Aisha approved her pink floral birthday cake.",
        date: now,
        read: false,
        href: "/orders/order-1048",
        type: "quote",
      },
      {
        id: "n2",
        title: "A little pantry top-up",
        text: "Butter, cream and 2 more items are running low.",
        date: now,
        read: false,
        href: "/inventory",
        type: "stock",
      },
      {
        id: "n3",
        title: "Advance received",
        text: "₹1,500 received from Aisha Rahman via UPI.",
        date: dateOffset(-1),
        read: false,
        href: "/orders/order-1048",
        type: "payment",
      },
      {
        id: "n4",
        title: "Three cakes, one lovely day",
        text: "You have 3 orders scheduled for today.",
        date: now,
        read: true,
        href: "/calendar",
        type: "order",
      },
    ],
  };
}
