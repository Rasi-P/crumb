import {
  cakeSchema,
  type CakeConfig,
  type CakeObject,
  type GeneratedModel,
  type ModelAttachment,
  type TierAttachment,
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
export const tierIdOf = (o: CakeObject) =>
  o.attachment.surface === "model" ? undefined : o.attachment.tierId;
export const modelIdOf = (o: CakeObject) =>
  o.attachment.surface === "model" ? o.attachment.modelId : undefined;
export function makeObject(
  assetId: string,
  tierId: string,
  seed = Date.now() % 1000000,
  id: string = crypto.randomUUID(),
): CakeObject & { attachment: TierAttachment } {
  const asset = assetById(assetId);
  if (!asset) throw new Error("Unknown decoration asset");
  return {
    id,
    assetId,
    name: asset.name,
    attachment: {
      tierId,
      surface: asset.allowedPlacements[0] as TierAttachment["surface"],
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
): (CakeObject & { attachment: TierAttachment })[] {
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
    o.attachment.surface === "model"
      ? c.generatedModels?.some((m) => m.id === modelIdOf(o))
      : c.tiers.some((t) => t.id === tierIdOf(o)),
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
  a: TierAttachment,
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
): TierAttachment {
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
// Generated models keep attachments in a normalized frame: the footprint spans
// one unit and the base sits at y = 0. These convert to and from world units.
export function modelPointToWorld(
  m: GeneratedModel,
  point: readonly [number, number, number],
): [number, number, number] {
  const s = m.diameter * UNIT,
    cos = Math.cos(m.rotation),
    sin = Math.sin(m.rotation);
  return [
    m.position[0] * UNIT + (point[0] * cos + point[2] * sin) * s,
    m.position[1] * UNIT + point[1] * s,
    m.position[2] * UNIT + (-point[0] * sin + point[2] * cos) * s,
  ];
}
export function worldPointToModel(
  m: GeneratedModel,
  point: readonly [number, number, number],
): [number, number, number] {
  const s = m.diameter * UNIT,
    x = (point[0] - m.position[0] * UNIT) / s,
    z = (point[2] - m.position[2] * UNIT) / s,
    cos = Math.cos(m.rotation),
    sin = Math.sin(m.rotation);
  return [
    x * cos - z * sin,
    (point[1] - m.position[1] * UNIT) / s,
    x * sin + z * cos,
  ];
}
export function modelDirectionToWorld(
  m: GeneratedModel,
  direction: readonly [number, number, number],
): [number, number, number] {
  const cos = Math.cos(m.rotation),
    sin = Math.sin(m.rotation);
  return [
    direction[0] * cos + direction[2] * sin,
    direction[1],
    -direction[0] * sin + direction[2] * cos,
  ];
}
export function worldDirectionToModel(
  m: GeneratedModel,
  direction: readonly [number, number, number],
): [number, number, number] {
  const cos = Math.cos(m.rotation),
    sin = Math.sin(m.rotation);
  return [
    direction[0] * cos - direction[2] * sin,
    direction[1],
    direction[0] * sin + direction[2] * cos,
  ];
}
export function modelAttachmentPosition(
  a: ModelAttachment,
  m: GeneratedModel,
): [number, number, number] {
  const p = modelPointToWorld(m, a.point),
    n = modelDirectionToWorld(m, a.normal);
  return [
    p[0] + n[0] * a.offset * UNIT,
    p[1] + n[1] * a.offset * UNIT,
    p[2] + n[2] * a.offset * UNIT,
  ];
}
// Spins an object around its surface normal (local +Y of the attachment
// frame) while keeping any tilt. Rotations are XYZ Euler angles, as rendered.
export function rotateAboutNormal(
  rotation: CakeObject["rotation"],
  radians: number,
): CakeObject["rotation"] {
  const [c1, c2, c3] = rotation.map((v) => Math.cos(v / 2)),
    [s1, s2, s3] = rotation.map((v) => Math.sin(v / 2)),
    bx = s1 * c2 * c3 + c1 * s2 * s3,
    by = c1 * s2 * c3 - s1 * c2 * s3,
    bz = c1 * c2 * s3 + s1 * s2 * c3,
    bw = c1 * c2 * c3 - s1 * s2 * s3,
    ay = Math.sin(radians / 2),
    aw = Math.cos(radians / 2),
    x = aw * bx + ay * bz,
    y = ay * bw + aw * by,
    z = aw * bz - ay * bx,
    w = aw * bw - ay * by,
    m13 = 2 * (x * z + w * y);
  return Math.abs(m13) < 0.9999999
    ? [
        Math.atan2(-2 * (y * z - w * x), 1 - 2 * (x * x + y * y)),
        Math.asin(m13),
        Math.atan2(-2 * (x * y - w * z), 1 - 2 * (y * y + z * z)),
      ]
    : [
        Math.atan2(2 * (y * z + w * x), 1 - 2 * (x * x + z * z)),
        Math.asin(Math.max(-1, Math.min(1, m13))),
        0,
      ];
}
// An independent copy with a slightly different turn, size and petal seed, so
// repeated flowers do not read as stamped clones.
export function variedCopy(o: CakeObject, seed: number): CakeObject {
  const vary = (n: number) => seedValue(seed + n) - 0.5;
  const copy: CakeObject = {
    ...structuredClone(o),
    id: crypto.randomUUID(),
    name: o.name.endsWith(" copy") ? o.name : `${o.name} copy`,
    seed,
    locked: false,
    rotation: rotateAboutNormal(o.rotation, 0.35 + vary(1) * 0.5),
    scale: Math.min(4, Math.max(0.1, o.scale * (1 + vary(2) * 0.08))),
  };
  if (copy.attachment.surface !== "model")
    copy.attachment.angle += copy.attachment.surface === "top" ? 0.5 : 0.18;
  return copy;
}
export function serializeCake(c: CakeConfig) {
  return JSON.stringify(cakeSchema.parse(normalizeCake(c)), null, 2);
}
export function deserializeCake(json: string) {
  if (json.length > 4_000_000) throw new Error("Cake file exceeds 4 MB");
  const parsed = cakeSchema.parse(JSON.parse(json));
  const c = normalizeCake(parsed);
  const ids = [
    ...c.tiers.map((t) => t.id),
    ...(c.objects || []).map((o) => o.id),
    ...(c.generatedModels || []).map((m) => m.id),
    "board",
    "text",
    "topper",
  ];
  if (new Set(ids).size !== ids.length)
    throw new Error("Every scene object must have a unique ID");
  return c;
}
