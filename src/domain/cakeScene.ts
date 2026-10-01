import {
  cakeSchema,
  type CakeConfig,
  type CakeObject,
  type Attachment,
  type Tier,
} from "./models";
import catalog from "../studio/assets/catalog.json";
export type AssetMetadata = {
  id: string;
  name: string;
  category: string;
  modelUrl?: string;
  thumbnail?: string;
  defaultScale: number;
  allowedPlacements: string[];
  material: CakeObject["material"];
  color: string;
  unitPrice: number;
  legacy: Tier["decorations"][number];
  kind: string;
};
export const assets = catalog as AssetMetadata[];
const legacyDecorationCosts: Record<Tier["decorations"][number], number> = {
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
export const assetById = (id: string) => assets.find((a) => a.id === id);
export const UNIT = 0.27; // one physical inch in world units
export const seedValue = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export function makeObject(
  assetId: string,
  tierId: string,
  seed = Date.now() % 1000000,
  id = crypto.randomUUID(),
): CakeObject {
  const asset = assetById(assetId);
  if (!asset) throw new Error("Unknown decoration asset");
  return {
    id,
    assetId,
    name: asset.name,
    attachment: {
      tierId,
      surface: asset.allowedPlacements[0] as Attachment["surface"],
      angle: 1.1,
      radius: 0.82,
      height: 0.65,
      offset: 0,
    },
    rotation: [asset.kind === "rose" ? 0.4 : 0, 0, seedValue(seed) * 0.4 - 0.2],
    scale: asset.defaultScale,
    color: asset.color,
    material: asset.material,
    seed,
    hidden: false,
    locked: false,
    unitPrice: asset.unitPrice,
  };
}
export function decorationGroup(
  assetId: string,
  tierId: string,
  count: number,
  spread = 360,
  seed = 13,
): CakeObject[] {
  return Array.from({ length: Math.min(100, Math.max(1, count)) }, (_, i) => {
    const o = makeObject(assetId, tierId, seed + i);
    const kind = assetById(assetId)?.kind;
    if (kind === "pearl")
      o.attachment = {
        tierId,
        surface: "side",
        angle:
          ((i / count) * spread * Math.PI) / 180 + 0.006 * seedValue(i + seed),
        radius: 1,
        height: 0.035,
        offset: 0,
      };
    else if (kind === "foil" || kind === "sprinkle")
      o.attachment = {
        tierId,
        surface: "side",
        angle: (seedValue(i + seed) * spread * Math.PI) / 180,
        radius: 1,
        height: 0.07 + seedValue(i + seed + 73) * 0.85,
        offset: 0,
      };
    else {
      o.attachment.angle =
        0.4 +
        i *
          (spread === 360
            ? 0.65
            : ((spread / Math.max(count, 1)) * Math.PI) / 180);
      o.scale *= 0.82 + seedValue(seed + i) * 0.3;
    }
    if (kind === "sprinkle")
      o.color = ["#d48f9f", "#d9c077", "#a1b69a", "#a5bfd6"][i % 4];
    return o;
  });
}
export function normalizeCake(input: CakeConfig): CakeConfig {
  const c = structuredClone(input);
  if (c.sceneVersion !== 2) {
    c.objects = [...(c.objects || [])];
    c.tiers.forEach((tier, ti) =>
      tier.decorations.forEach((legacy, di) => {
        const a = assets.find((a) => a.legacy === legacy)!;
        const count =
          legacy === "Pearls"
            ? 48
            : legacy === "Gold accents"
              ? 28
              : legacy === "Sprinkles"
                ? 65
                : legacy === "Roses" || legacy === "Flowers"
                  ? 3
                  : legacy === "Characters" || legacy === "Ribbons"
                    ? 1
                    : 3;
        const group = decorationGroup(
          a.id,
          tier.id,
          count,
          360,
          31 + ti * 70 + di * 20,
        );
        group.forEach((o, i) => {
          o.id = `asset-${tier.id}-${di}-${i}`;
          // Preserve existing quotation totals when category bundles become objects.
          const cents = Math.round(legacyDecorationCosts[legacy] * 100);
          o.unitPrice =
            (Math.floor(cents / count) + (i < cents % count ? 1 : 0)) / 100;
          if (a.kind === "rose") {
            o.assetId = i === 1 ? "rose-open" : a.id;
            o.scale = i === 0 ? 1.02 : i === 1 ? 0.76 : 0.51;
            // A staggered florist cluster, with supporting blooms angled outward.
            o.attachment.angle = (ti % 2 ? 2.05 : 0.56) + [0, -0.16, 0.3][i];
            o.attachment.surface = i === 0 || i === 2 ? "side" : "top";
            o.rotation =
              i === 1
                ? [0.85, -0.2, ti % 2 ? 0.2 : -0.4]
                : [0.12, i * 0.8, -0.14];
            o.attachment.height = i === 2 ? 0.66 : 0.94;
            o.attachment.radius = ti % 2 ? 0.64 : 0.96;
          }
        });
        c.objects!.push(...group);
      }),
    );
  }
  c.sceneVersion = 2;
  c.objects = (c.objects || []).filter((o) =>
    c.tiers.some((t) => t.id === o.attachment.tierId),
  );
  c.tiers = c.tiers.map((t) => ({ ...t, decorations: [] }));
  c.board ??= {
    diameter: Math.max(...c.tiers.map((t) => t.diameter)) + 2,
    thickness: 0.4,
    material: "Fondant",
  };
  c.board.diameter = Math.max(
    c.board.diameter,
    Math.min(
      24,
      Math.max(
        ...c.tiers.map(
          (t) =>
            t.diameter * ((t.shape ?? c.shape) === "Square" ? Math.SQRT2 : 1) +
            Math.hypot(...(t.position ?? [0, 0])) * 2,
        ),
      ) + 0.8,
    ),
  );
  c.background ??= { color: "#e8e2db", exposure: 1.05 };
  c.camera ??= { view: "Perspective", zoom: 0 };
  c.lettering ??= {
    text: {
      font: "great-vibes",
      size: 0.32,
      depth: 0.03,
      color: c.textColor,
      material: "Gold",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
      hidden: false,
      locked: false,
    },
    topper: {
      font: "great-vibes",
      size: 0.8,
      depth: 0.035,
      color: "#c7a054",
      material: "Gold",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
      hidden: false,
      locked: false,
    },
  };
  c.lettering.text.color = c.textColor;
  return c;
}
export function tierLayout(c: CakeConfig) {
  let base = (c.board?.thickness ?? 0.4) * UNIT;
  return c.tiers.map((tier) => {
    base += (tier.spacing ?? 0) * UNIT;
    const height = tier.height * UNIT;
    const result = {
      tier,
      bottom: base,
      top: base + height,
      height,
      radius: (tier.diameter * UNIT) / 2,
      x: (tier.position?.[0] ?? 0) * UNIT,
      z: (tier.position?.[1] ?? 0) * UNIT,
    };
    base += height;
    return result;
  });
}
export type TierLayout = ReturnType<typeof tierLayout>[number];
const heartSamples = Array.from({ length: 128 }, (_, i) => {
  const t = (i / 128) * Math.PI * 2;
  return [
    Math.pow(Math.sin(t), 3),
    -(
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t)
    ) / 17,
  ] as const;
});
const heartRadii = new Map<number, number>();
function heartRadius(angle: number) {
  const key = Math.round(angle * 1e6);
  if (heartRadii.has(key)) return heartRadii.get(key)!;
  const dx = Math.cos(angle),
    dz = Math.sin(angle);
  let distance = 0;
  for (let i = 0; i < heartSamples.length; i++) {
    const a = heartSamples[i],
      b = heartSamples[(i + 1) % heartSamples.length],
      ex = b[0] - a[0],
      ez = b[1] - a[1],
      det = dx * ez - dz * ex;
    if (Math.abs(det) < 1e-8) continue;
    const r = (a[0] * ez - a[1] * ex) / det,
      u = (a[0] * dz - a[1] * dx) / det;
    if (r > 0 && u >= 0 && u <= 1) distance = Math.max(distance, r);
  }
  heartRadii.set(key, distance || 1);
  return distance || 1;
}
export function perimeterRadius(
  shape: CakeConfig["shape"],
  radius: number,
  angle: number,
) {
  if (shape === "Square")
    return (
      radius /
      Math.pow(
        Math.pow(Math.abs(Math.cos(angle)), 16) +
          Math.pow(Math.abs(Math.sin(angle)), 16),
        1 / 16,
      )
    );
  if (shape === "Heart") return radius * heartRadius(angle);
  if (shape === "Custom") return radius * (1 + 0.07 * Math.cos(angle * 6));
  return radius;
}
export function attachmentPosition(
  a: Attachment,
  l: TierLayout,
  shape: CakeConfig["shape"] = "Round",
): [number, number, number] {
  const r =
    perimeterRadius(l.tier.shape ?? shape, l.radius, a.angle) *
    (a.surface === "side" ? 1 : a.radius);
  const extra = a.surface === "side" ? a.offset * UNIT : 0;
  return [
    l.x + Math.cos(a.angle) * (r + extra),
    a.surface === "top"
      ? l.top + a.offset * UNIT
      : l.bottom + l.height * a.height,
    l.z + Math.sin(a.angle) * (r + extra),
  ];
}
export function attachmentFromPoint(
  point: [number, number, number],
  l: TierLayout,
  shape: CakeConfig["shape"],
  top: boolean,
): Attachment {
  const x = point[0] - l.x,
    z = point[2] - l.z,
    angle = Math.atan2(z, x);
  return {
    tierId: l.tier.id,
    surface: top ? "top" : "side",
    angle,
    radius: Math.min(
      1,
      Math.hypot(x, z) /
        perimeterRadius(l.tier.shape ?? shape, l.radius, angle),
    ),
    height: Math.max(0, Math.min(1, (point[1] - l.bottom) / l.height)),
    offset: 0,
  };
}
export function serializeCake(c: CakeConfig) {
  return JSON.stringify(cakeSchema.parse(normalizeCake(c)), null, 2);
}
export function deserializeCake(json: string) {
  if (json.length > 4_000_000) throw new Error("Cake file exceeds 4 MB");
  const parsed = cakeSchema.parse(JSON.parse(json));
  if (
    parsed.objects?.some(
      (o) => !parsed.tiers.some((t) => t.id === o.attachment.tierId),
    )
  )
    throw new Error("A decoration refers to a missing tier");
  const c = normalizeCake(parsed);
  const ids = [
    ...c.tiers.map((t) => t.id),
    ...(c.objects || []).map((o) => o.id),
    "board",
    "text",
    "topper",
  ];
  if (new Set(ids).size !== ids.length)
    throw new Error("Every scene object must have a unique ID");
  return c;
}
