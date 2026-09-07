import { z } from "zod";
import {
  businessSchema,
  customerSchema,
  designSchema,
  expenseSchema,
  inventorySchema,
  orderSchema,
  paymentSchema,
  productSchema,
  quoteSchema,
  statuses,
  uid,
  type AppState,
} from "./models";
import { balance, calculatePrice, recipeFor } from "./pricing";

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("customer.save"), value: customerSchema }),
  z.object({ type: z.literal("design.save"), value: designSchema }),
  z.object({ type: z.literal("product.save"), value: productSchema }),
  z.object({ type: z.literal("order.save"), value: orderSchema }),
  z.object({
    type: z.literal("order.status"),
    id: z.string(),
    status: z.enum(statuses),
    consume: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("order.note"),
    id: z.string(),
    text: z.string().min(1).max(2000),
  }),
  z.object({ type: z.literal("payment.add"), value: paymentSchema }),
  z.object({ type: z.literal("inventory.save"), value: inventorySchema }),
  z.object({
    type: z.literal("inventory.adjust"),
    id: z.string(),
    quantity: z.number().finite(),
    reason: z.string().min(2).max(300),
  }),
  z.object({ type: z.literal("expense.save"), value: expenseSchema }),
  z.object({ type: z.literal("business.save"), value: businessSchema }),
  z.object({ type: z.literal("quote.save"), value: quoteSchema }),
  z.object({
    type: z.literal("quote.respond"),
    token: z.string(),
    status: z.enum(["Viewed", "Approved", "Changes Requested"]),
    request: z.string().max(2000),
  }),
  z.object({ type: z.literal("notifications.read") }),
]);
export type Command = z.infer<typeof commandSchema>;
function upsert<T extends { id: string }>(list: T[], value: T) {
  const index = list.findIndex((x) => x.id === value.id);
  if (index < 0) list.unshift(value);
  else list[index] = value;
}
function requireEntity<T extends { id: string }>(
  list: T[],
  id: string,
  label: string,
) {
  const item = list.find((x) => x.id === id);
  if (!item)
    throw new Error(`${label} no longer exists. Refresh and try again.`);
  return item;
}
export function canTransition(from: string, to: string) {
  if (from === to) return true;
  if (from === "Cancelled" || from === "Completed") return false;
  return true;
}
export function applyCommand(input: AppState, raw: Command): AppState {
  const command = commandSchema.parse(raw);
  const s = structuredClone(input);
  const now = new Date().toISOString();
  const notify = (
    title: string,
    text: string,
    href: string,
    type: AppState["notifications"][number]["type"],
  ) => {
    if (!s.business.notifications) return;
    s.notifications.unshift({
      id: uid(),
      title,
      text,
      href,
      type,
      date: now,
      read: false,
    });
  };
  switch (command.type) {
    case "customer.save":
      upsert(s.customers, command.value);
      break;
    case "design.save":
      upsert(s.designs, { ...command.value, updatedAt: now });
      break;
    case "product.save":
      requireEntity(s.designs, command.value.designId, "Design");
      upsert(s.products, command.value);
      break;
    case "order.save": {
      requireEntity(s.customers, command.value.customerId, "Customer");
      requireEntity(s.designs, command.value.designId, "Design");
      const previous = s.orders.find((o) => o.id === command.value.id);
      if (previous && ["Completed", "Cancelled"].includes(previous.status))
        throw new Error(
          "Completed or cancelled orders cannot be edited. Duplicate the order instead.",
        );
      const computed = calculatePrice(
        command.value.config,
        s.business.margin,
        s.inventory,
      );
      const value = {
        ...command.value,
        config: { ...command.value.config, sellingPrice: computed.selling },
        total: computed.total,
        cost: computed.cost,
        number:
          previous?.number ??
          Math.max(1000, ...s.orders.map((o) => o.number)) + 1,
      };
      if (previous && balance(previous, s.payments).paid > value.total)
        throw new Error(
          "Record a refund before reducing the order below the amount already paid.",
        );
      upsert(s.orders, value);
      if (!previous)
        notify(
          "A new celebration",
          `${value.cakeName} is on the books.`,
          `/orders/${value.id}`,
          "order",
        );
      break;
    }
    case "order.status": {
      const order = requireEntity(s.orders, command.id, "Order");
      if (!canTransition(order.status, command.status))
        throw new Error(
          "This order is closed. Duplicate it to start a new order.",
        );
      if (order.status === command.status) break;
      if (command.status === "Paid" && balance(order, s.payments).remaining > 0)
        throw new Error(
          "Record the remaining payment before marking this order paid.",
        );
      if (command.status === "Cancelled" && balance(order, s.payments).paid > 0)
        throw new Error("Refund the customer before cancelling this order.");
      if (
        command.status === "Completed" &&
        command.consume &&
        !order.inventoryConsumed
      ) {
        const recipe = recipeFor(order.config);
        const deficits = recipe.filter((r) => {
          const item = s.inventory.find((i) => i.name === r.name);
          return !item || item.stock < r.quantity;
        });
        if (deficits.length)
          throw new Error(
            `Not enough ${deficits.map((d) => d.name.toLowerCase()).join(", ")}. Add stock or complete without recording ingredients.`,
          );
        recipe.forEach((r) => {
          const item = s.inventory.find((i) => i.name === r.name)!;
          item.stock = Math.round((item.stock - r.quantity) * 1000) / 1000;
          item.history.unshift({
            date: now,
            quantity: -r.quantity,
            reason: `Order #${order.number}`,
          });
        });
        order.inventoryConsumed = true;
      }
      order.status = command.status;
      order.activity.unshift({
        id: uid(),
        date: now,
        text: `Production updated to ${command.status.toLowerCase()}.`,
      });
      break;
    }
    case "order.note":
      requireEntity(s.orders, command.id, "Order").activity.unshift({
        id: uid(),
        date: now,
        text: command.text,
      });
      break;
    case "payment.add": {
      const p = command.value;
      const order = requireEntity(s.orders, p.orderId, "Order");
      const b = balance(order, s.payments);
      if (s.payments.some((x) => x.id === p.id)) break;
      if (order.status === "Cancelled")
        throw new Error("Payments cannot be recorded on a cancelled order.");
      if (p.kind === "Payment" && p.amount > b.remaining)
        throw new Error(
          `Payment exceeds the remaining balance of ₹${b.remaining}.`,
        );
      if (p.kind === "Refund" && p.amount > b.paid)
        throw new Error("Refund exceeds the amount received.");
      s.payments.unshift(p);
      order.activity.unshift({
        id: uid(),
        date: now,
        text: `${p.kind === "Refund" ? "Refunded" : "Received"} ₹${p.amount.toLocaleString("en-IN")} via ${p.method}.`,
      });
      notify(
        p.kind === "Refund" ? "Refund recorded" : "Payment received",
        `₹${p.amount.toLocaleString("en-IN")} for order #${order.number}.`,
        `/orders/${order.id}`,
        "payment",
      );
      break;
    }
    case "inventory.save":
      upsert(s.inventory, command.value);
      break;
    case "inventory.adjust": {
      const item = requireEntity(s.inventory, command.id, "Inventory item");
      if (item.stock + command.quantity < 0)
        throw new Error(
          "Stock cannot be negative. Check the adjustment quantity.",
        );
      item.stock = Math.round((item.stock + command.quantity) * 1000) / 1000;
      item.history.unshift({
        date: now,
        quantity: command.quantity,
        reason: command.reason,
      });
      break;
    }
    case "expense.save":
      upsert(s.expenses, command.value);
      break;
    case "business.save":
      s.business = command.value;
      break;
    case "quote.save": {
      requireEntity(s.customers, command.value.customerId, "Customer");
      requireEntity(s.designs, command.value.designId, "Design");
      if (command.value.orderId) {
        const order = requireEntity(s.orders, command.value.orderId, "Order");
        if (order.customerId !== command.value.customerId)
          throw new Error(
            "The quotation customer must match the order customer.",
          );
        if (!s.quotes.some((q) => q.id === command.value.id)) {
          order.activity.unshift({
            id: uid(),
            date: now,
            text: "A quotation was prepared for customer approval.",
          });
          if (order.status === "Inquiry") order.status = "Quotation Sent";
        }
      }
      const quotePrice = calculatePrice(
        command.value.config,
        s.business.margin,
        s.inventory,
      );
      upsert(s.quotes, {
        ...command.value,
        config: { ...command.value.config, sellingPrice: quotePrice.selling },
        total: quotePrice.total,
      });
      break;
    }
    case "quote.respond": {
      const quote = s.quotes.find((q) => q.token === command.token);
      if (!quote) throw new Error("This quotation could not be found.");
      if (command.status === "Viewed") {
        if (quote.status === "Sent") quote.status = "Viewed";
        break;
      }
      if (new Date(quote.validUntil + "T23:59:59") < new Date())
        throw new Error(
          "This quotation has expired. Please contact the bakery for a fresh quote.",
        );
      if (quote.status === "Approved")
        throw new Error(
          "This design has already been approved. Contact the bakery for further changes.",
        );
      if (command.status === "Changes Requested" && !command.request.trim())
        throw new Error("Please describe the changes you would like.");
      quote.status = command.status;
      quote.request = command.request;
      if (quote.orderId) {
        const order = requireEntity(s.orders, quote.orderId, "Order");
        order.activity.unshift({
          id: uid(),
          date: now,
          text:
            command.status === "Approved"
              ? "Customer approved the cake design."
              : `Customer requested changes: ${command.request}`,
        });
        if (
          command.status === "Approved" &&
          ["Inquiry", "Quotation Sent"].includes(order.status)
        )
          order.status = "Confirmed";
      }
      notify(
        command.status === "Approved"
          ? "A lovely design, approved"
          : "A few finishing touches",
        `${quote.name}${command.request ? `: ${command.request}` : " was approved."}`,
        quote.orderId ? `/orders/${quote.orderId}` : `/catalog?tab=quotes`,
        "quote",
      );
      break;
    }
    case "notifications.read":
      s.notifications.forEach((n) => (n.read = true));
      break;
  }
  s.revision++;
  return s;
}
