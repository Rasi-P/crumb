import { z } from "zod";
import { cakeSchema, decorations, type CakeConfig } from "./models";

// Future AI adapters produce validated operations. Inspiration images never replace this model.
export const designOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setFlavor"), flavor: z.string().min(1) }),
  z.object({ type: z.literal("setShape"), shape: cakeSchema.shape.shape }),
  z.object({
    type: z.literal("setColor"),
    tierId: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  z.object({
    type: z.literal("addDecoration"),
    tierId: z.string(),
    decoration: z.enum(decorations),
  }),
  z.object({
    type: z.literal("removeDecoration"),
    tierId: z.string(),
    decoration: z.enum(decorations),
  }),
  z.object({ type: z.literal("setText"), text: z.string().max(80) }),
  z.object({ type: z.literal("replaceTiers"), tiers: cakeSchema.shape.tiers }),
]);
export type DesignOperation = z.infer<typeof designOperationSchema>;
export function applyDesignOperations(
  config: CakeConfig,
  raw: unknown,
): CakeConfig {
  const operations = z.array(designOperationSchema).max(50).parse(raw);
  let next = structuredClone(config);
  for (const operation of operations) {
    if (
      "tierId" in operation &&
      !next.tiers.some((t) => t.id === operation.tierId)
    )
      throw new Error("The selected tier no longer exists.");
    switch (operation.type) {
      case "setFlavor":
        next.flavor = operation.flavor;
        break;
      case "setShape":
        next.shape = operation.shape;
        break;
      case "setText":
        next.text = operation.text;
        break;
      case "replaceTiers":
        next.tiers = operation.tiers;
        break;
      case "setColor":
        next.tiers = next.tiers.map((t) =>
          t.id === operation.tierId ? { ...t, color: operation.color } : t,
        );
        break;
      case "addDecoration":
        next.tiers = next.tiers.map((t) =>
          t.id === operation.tierId
            ? {
                ...t,
                decorations: Array.from(
                  new Set([...t.decorations, operation.decoration]),
                ),
              }
            : t,
        );
        break;
      case "removeDecoration":
        next.tiers = next.tiers.map((t) =>
          t.id === operation.tierId
            ? {
                ...t,
                decorations: t.decorations.filter(
                  (d) => d !== operation.decoration,
                ),
              }
            : t,
        );
        break;
    }
  }
  return cakeSchema.parse(next);
}
