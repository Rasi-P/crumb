import type { Attachment, CakeConfig, CakeObject } from "../domain/models";
import { modelIdOf, tierIdOf, variedCopy } from "../domain/cakeScene";

// Selection IDs: a tier, object or generated-model ID; "board", "text" or
// "topper"; or "<modelId>/<partKey>" for one separable part of a model.
export function partOf(config: CakeConfig, id: string) {
  const [modelId, key] = id.split("/"),
    model = key && config.generatedModels?.find((m) => m.id === modelId);
  return model ? { model, key } : null;
}
export function isLocked(config: CakeConfig, id: string) {
  return !!(
    config.objects?.find((o) => o.id === id)?.locked ||
    config.tiers.find((t) => t.id === id)?.locked ||
    (
      partOf(config, id)?.model ??
      config.generatedModels?.find((m) => m.id === id)
    )?.locked ||
    ((id === "text" || id === "topper") && config.lettering?.[id].locked)
  );
}

// Removes every unlocked item in the selection. A part of a generated mesh
// cannot be cut out of the file, so deleting one hides it instead.
export function removeSelection(config: CakeConfig, ids: string[]) {
  const c = structuredClone(config);
  for (const id of ids) {
    if (isLocked(c, id)) continue;
    const part = partOf(c, id);
    if (part)
      part.model.parts = part.model.parts?.map((p) =>
        p.key === part.key ? { ...p, hidden: true } : p,
      );
    else if (c.objects?.some((o) => o.id === id))
      c.objects = c.objects.filter((o) => o.id !== id);
    else if (id === "text" || id === "topper") c[id] = "";
    else if (c.generatedModels?.some((m) => m.id === id)) {
      c.generatedModels = c.generatedModels.filter((m) => m.id !== id);
      c.objects = c.objects?.filter((o) => modelIdOf(o) !== id);
      // Without a generated mesh the parametric cake is the cake again.
      if (!c.generatedModels.length) {
        c.tiers = c.tiers.map((t) => ({ ...t, hidden: false }));
        c.board = { ...c.board!, hidden: false };
      }
    } else if (c.tiers.length > 1 && c.tiers.some((t) => t.id === id)) {
      c.tiers = c.tiers.filter((t) => t.id !== id);
      c.objects = c.objects?.filter((o) => tierIdOf(o) !== id);
    }
  }
  return c;
}

export function duplicateSelection(
  config: CakeConfig,
  ids: string[],
  beside?: (o: CakeObject) => Attachment | null,
) {
  const c = structuredClone(config),
    created: string[] = [];
  let seed = Date.now() % 1000000;
  for (const id of ids) {
    const object = config.objects?.find((o) => o.id === id),
      tier = config.tiers.find((t) => t.id === id);
    if (object && !object.locked && (c.objects?.length ?? 0) < 1500) {
      const copy = variedCopy(object, seed++);
      // On a generated mesh there is no angle to step along; ask the scene
      // for a nearby point on the actual surface.
      if (copy.attachment.surface === "model")
        copy.attachment = beside?.(object) ?? copy.attachment;
      c.objects!.push(copy);
      created.push(copy.id);
    } else if (tier && !tier.locked && c.tiers.length < 4) {
      const tierId = crypto.randomUUID();
      c.tiers.push({ ...structuredClone(tier), id: tierId, locked: false });
      c.objects!.push(
        ...config
          .objects!.filter((o) => tierIdOf(o) === tier.id)
          .map((o) => ({
            ...structuredClone(o),
            id: crypto.randomUUID(),
            attachment: { ...o.attachment, tierId },
          })),
      );
      created.push(tierId);
    }
  }
  return { config: c, created };
}
