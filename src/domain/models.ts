import { z } from "zod";

export const statuses = [
  "Inquiry",
  "Quotation Sent",
  "Confirmed",
  "Paid",
  "Preparing",
  "Baking",
  "Decorating",
  "Ready",
  "Out for Delivery",
  "Completed",
  "Cancelled",
] as const;
export const stages = [
  "Confirmed",
  "Preparing",
  "Baking",
  "Decorating",
  "Ready",
  "Completed",
] as const;
export const categories = [
  "Birthday",
  "Wedding",
  "Anniversary",
  "Baby Shower",
  "Kids",
  "Corporate",
  "Cupcakes",
  "Seasonal",
  "Custom",
];
export const flavors = [
  "Vanilla",
  "Chocolate",
  "Red Velvet",
  "Lemon",
  "Strawberry",
  "Salted Caramel",
  "Pistachio",
];
export const decorations = [
  "Roses",
  "Flowers",
  "Pearls",
  "Macarons",
  "Chocolate",
  "Fruit",
  "Sprinkles",
  "Ribbons",
  "Characters",
  "Leaves",
  "Gold accents",
] as const;
const money = z.number().finite().min(0).max(10000000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const vector3 = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
export const materialNames = [
  "Buttercream",
  "Fondant",
  "Cream",
  "Chocolate",
  "Gold",
  "Silver",
  "Petal",
  "Satin",
] as const;
const tierAttachmentSchema = z.object({
  tierId: z.string(),
  surface: z.enum(["top", "side"]),
  // Radians, normalized radius, normalized height, and outward offset in inches.
  angle: z.number().finite(),
  radius: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  offset: z.number().min(-0.1).max(2),
});
// A point on a generated model, in that model's normalized frame (footprint
// one unit wide, base at y = 0). Moving or resizing the model carries it along.
const modelAttachmentSchema = z.object({
  surface: z.literal("model"),
  modelId: z.string(),
  point: vector3,
  normal: vector3,
  offset: z.number().min(-0.1).max(2),
});
export const attachmentSchema = z.discriminatedUnion("surface", [
  tierAttachmentSchema,
  modelAttachmentSchema,
]);
export const cakeObjectSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1).max(120),
  name: z.string().min(1).max(100),
  attachment: attachmentSchema,
  rotation: vector3,
  scale: z.number().min(0.1).max(4),
  color,
  material: z.enum(materialNames),
  seed: z.number().int(),
  hidden: z.boolean(),
  locked: z.boolean(),
  unitPrice: money,
  // Free Transform displacement from the attached surface point, in inches.
  nudge: vector3.optional(),
});
const studioAssetUrl = z
  .string()
  .regex(/^\/api\/studio\/assets\/[a-f0-9]{32}$/);
export const referenceViews = ["front", "left", "back", "right"] as const;
export const referenceImageSchema = z.object({
  id: z.string().min(1),
  url: studioAssetUrl,
  view: z.enum(referenceViews),
});
// Geometry produced by an image-to-3D service (or an imported GLB). The mesh
// itself is never rebuilt from primitives; the document stores where it sits.
export const generatedModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  url: studioAssetUrl,
  source: z.enum(["generated", "imported"]),
  // Width of the model's footprint in inches; position in inches; Y rotation.
  diameter: z.number().min(2).max(30),
  // Measured height as a fraction of the footprint width.
  height: z.number().min(0.01).max(20),
  position: vector3,
  rotation: z.number().finite(),
  hidden: z.boolean(),
  locked: z.boolean(),
  parts: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        name: z.string().min(1).max(100),
        hidden: z.boolean(),
      }),
    )
    .max(64)
    .optional(),
});
const letteringSchema = z.object({
  font: z.enum(["helvetiker", "optimer", "great-vibes"]),
  size: z.number().min(0.15).max(1.5),
  depth: z.number().min(0.02).max(0.3),
  color,
  material: z.enum(materialNames),
  position: vector3,
  rotation: vector3,
  scale: z.number().min(0.2).max(3),
  hidden: z.boolean(),
  locked: z.boolean(),
});
export const tierSchema = z.object({
  id: z.string(),
  diameter: z.number().min(4).max(16),
  height: z.number().min(2).max(8),
  color,
  frosting: z.enum(["Buttercream", "Fondant", "Ganache", "Whipped Cream"]),
  finish: z.enum([
    "Smooth",
    "Textured",
    "Vintage",
    "Minimal",
    "Ruffled",
    "Drip",
    "Rough",
    "Semi-naked",
    "Naked",
    "Piped",
  ]),
  decorations: z.array(z.enum(decorations)).max(11),
  shape: z.enum(["Round", "Square", "Heart", "Number", "Custom"]).optional(),
  position: z
    .tuple([z.number().min(-8).max(8), z.number().min(-8).max(8)])
    .optional(),
  spacing: z.number().min(0).max(4).optional(),
  roughness: z.number().min(0.1).max(1).optional(),
  specular: z.number().min(0).max(1).optional(),
  imperfection: z.number().min(0).max(1).optional(),
  frostingThickness: z.number().min(0.02).max(0.3).optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});
export const cakeSchema = z
  .object({
    version: z.literal(1),
    shape: z.enum(["Round", "Square", "Heart", "Number", "Custom"]),
    tiers: z.array(tierSchema).min(1).max(4),
    flavor: z.string().min(1),
    text: z.string().max(80),
    textColor: color,
    textStyle: z.enum(["Elegant", "Modern", "Playful"]),
    textSize: z.number().min(12).max(40),
    topper: z.string().max(50),
    number: z.string().max(2),
    boardColor: color,
    sellingPrice: money.nullable(),
    delivery: money,
    discount: money,
    tax: z.number().min(0).max(40),
    sceneVersion: z.literal(2).optional(),
    cakeId: z.string().optional(),
    objects: z.array(cakeObjectSchema).max(1500).optional(),
    board: z
      .object({
        diameter: z.number().min(4).max(24),
        thickness: z.number().min(0.1).max(1),
        material: z.enum(materialNames),
        hidden: z.boolean().optional(),
      })
      .optional(),
    background: z
      .object({ color, exposure: z.number().min(0.4).max(2) })
      .optional(),
    camera: z
      .object({
        view: z.enum(["Perspective", "Front", "Side", "Top", "Close-up"]),
        zoom: z.number().min(-3).max(8),
      })
      .optional(),
    lettering: z
      .object({ text: letteringSchema, topper: letteringSchema })
      .optional(),
    referenceImages: z.array(referenceImageSchema).max(4).optional(),
    generatedModels: z.array(generatedModelSchema).max(4).optional(),
  })
  .superRefine((cake, ctx) => {
    const ids = new Set<string>(["board", "text", "topper"]);
    for (const [i, t] of cake.tiers.entries()) {
      if (ids.has(t.id))
        ctx.addIssue({
          code: "custom",
          message: "Every scene object must have a unique ID",
          path: ["tiers", i, "id"],
        });
      ids.add(t.id);
    }
    for (const [i, m] of (cake.generatedModels || []).entries()) {
      if (ids.has(m.id))
        ctx.addIssue({
          code: "custom",
          message: "Every scene object must have a unique ID",
          path: ["generatedModels", i, "id"],
        });
      ids.add(m.id);
    }
    for (const [i, o] of (cake.objects || []).entries()) {
      if (ids.has(o.id))
        ctx.addIssue({
          code: "custom",
          message: "Every scene object must have a unique ID",
          path: ["objects", i, "id"],
        });
      ids.add(o.id);
      if (o.attachment.surface === "model") {
        const modelId = o.attachment.modelId;
        if (!cake.generatedModels?.some((m) => m.id === modelId))
          ctx.addIssue({
            code: "custom",
            message: "A decoration refers to a missing model",
            path: ["objects", i, "attachment", "modelId"],
          });
      } else {
        const tierId = o.attachment.tierId;
        if (!cake.tiers.some((t) => t.id === tierId))
          ctx.addIssue({
            code: "custom",
            message: "A decoration refers to a missing tier",
            path: ["objects", i, "attachment", "tierId"],
          });
      }
    }
  });
export type CakeConfig = z.infer<typeof cakeSchema>;
export type CakeConfiguration = CakeConfig;
export type CakeObject = z.infer<typeof cakeObjectSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type TierAttachment = z.infer<typeof tierAttachmentSchema>;
export type ModelAttachment = z.infer<typeof modelAttachmentSchema>;
export type GeneratedModel = z.infer<typeof generatedModelSchema>;
export type ReferenceImage = z.infer<typeof referenceImageSchema>;
export type Tier = z.infer<typeof tierSchema>;
export const customerSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100),
  email: z.union([z.email(), z.literal("")]),
  phone: z.string().max(25),
  address: z.string().max(500),
  flavor: z.string(),
  style: z.string(),
  colors: z.string(),
  notes: z.string().max(2000),
  createdAt: z.string(),
});
export const designSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100),
  category: z.string(),
  config: cakeSchema,
  image: z.number().int().min(0).max(11),
  state: z.enum(["Draft", "Saved", "Published", "Archived"]),
  favorite: z.boolean(),
  template: z.boolean(),
  updatedAt: z.string(),
});
export const activitySchema = z.object({
  id: z.string(),
  date: z.string(),
  text: z.string(),
});
export const orderSchema = z.object({
  id: z.string(),
  number: z.number(),
  customerId: z.string(),
  designId: z.string(),
  cakeName: z.string(),
  config: cakeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
  fulfillment: z.enum(["Delivery", "Pickup"]),
  address: z.string().max(500),
  status: z.enum(statuses),
  total: money,
  cost: money,
  notes: z.string().max(5000),
  priority: z.enum(["Normal", "High"]),
  activity: z.array(activitySchema),
  inventoryConsumed: z.boolean(),
  createdAt: z.string(),
});
export const paymentSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  amount: money.positive(),
  method: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Other"]),
  reference: z.string().max(100),
  date: z.string(),
  kind: z.enum(["Payment", "Refund"]),
});
export const inventorySchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100),
  category: z.enum(["Ingredients", "Packaging", "Decorations"]),
  stock: z.number().finite().min(0),
  unit: z.string().min(1),
  cost: money,
  minimum: money,
  history: z.array(
    z.object({ date: z.string(), quantity: z.number(), reason: z.string() }),
  ),
});
export const expenseSchema = z.object({
  id: z.string(),
  date: z.string(),
  description: z.string().min(2).max(200),
  category: z.enum([
    "Ingredients",
    "Packaging",
    "Delivery",
    "Equipment",
    "Decorations",
    "Electricity",
    "Marketing",
    "Other",
  ]),
  amount: money.positive(),
  note: z.string().max(1000),
});
export const productSchema = z.object({
  id: z.string(),
  designId: z.string(),
  name: z.string().min(2).max(100),
  category: z.string(),
  price: money,
  description: z.string().max(1000),
  archived: z.boolean(),
});
export const quoteSchema = z.object({
  id: z.string(),
  token: z.string(),
  customerId: z.string(),
  designId: z.string(),
  config: cakeSchema,
  name: z.string(),
  total: money,
  date: z.string(),
  validUntil: z.string(),
  status: z.enum(["Sent", "Viewed", "Approved", "Changes Requested"]),
  request: z.string(),
  orderId: z.string().nullable(),
});
export const businessSchema = z.object({
  name: z.string().min(2),
  owner: z.string().min(2),
  email: z.union([z.email(), z.literal("")]),
  phone: z.string(),
  address: z.string(),
  instagram: z.string(),
  whatsapp: z.string(),
  currency: z.literal("INR"),
  tax: z.number().min(0).max(40),
  margin: z.number().min(5).max(80),
  hours: z.string(),
  zones: z.string(),
  deliveryFee: money,
  terms: z.string().max(2000),
  notifications: z.boolean(),
  theme: z.enum(["Light", "Dark", "System"]),
  logo: z.string().max(500000),
});
export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  date: z.string(),
  read: z.boolean(),
  href: z.string(),
  type: z.enum(["order", "payment", "stock", "quote"]),
});
export const stateSchema = z.object({
  business: businessSchema,
  customers: z.array(customerSchema),
  designs: z.array(designSchema),
  products: z.array(productSchema),
  orders: z.array(orderSchema),
  payments: z.array(paymentSchema),
  inventory: z.array(inventorySchema),
  expenses: z.array(expenseSchema),
  quotes: z.array(quoteSchema),
  notifications: z.array(notificationSchema),
  revision: z.number(),
});
export type Customer = z.infer<typeof customerSchema>;
export type Design = z.infer<typeof designSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type InventoryItem = z.infer<typeof inventorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Product = z.infer<typeof productSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Business = z.infer<typeof businessSchema>;
export type AppState = z.infer<typeof stateSchema>;
export type OrderStatus = Order["status"];
export const uid = () => crypto.randomUUID();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dateOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
