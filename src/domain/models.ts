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
  ]),
  decorations: z.array(z.enum(decorations)).max(11),
});
export const cakeSchema = z.object({
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
});
export type CakeConfig = z.infer<typeof cakeSchema>;
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
