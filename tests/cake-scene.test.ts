import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { defaultCake } from "../src/domain/seed";
import { cakeSchema } from "../src/domain/models";
import {
  attachmentFromPoint,
  attachmentPosition,
  decorationGroup,
  deserializeCake,
  normalizeCake,
  serializeCake,
  tierLayout,
  UNIT,
} from "../src/domain/cakeScene";
import { calculatePrice } from "../src/domain/pricing";
import { tierGeometry, flowerGeometry } from "../src/studio/scene/geometry";
import { configurationFromAnalysis } from "../src/studio/services/ImageToCakeService";
describe("structured cake scene", () => {
  it("migrates old category bundles once with stable individual IDs and unchanged quotations", () => {
    const original = defaultCake(),
      c = normalizeCake(original);
    expect(c.objects!.length).toBeGreaterThan(50);
    expect(new Set(c.objects!.map((o) => o.id)).size).toBe(c.objects!.length);
    expect(c.tiers.every((t) => t.decorations.length === 0)).toBe(true);
    expect(normalizeCake(c)).toEqual(c);
    expect(normalizeCake(original)).toEqual(c);
    expect(calculatePrice(c).cost).toBe(calculatePrice(original).cost);
    expect(original.tiers[0].decorations).toContain("Roses");
  });
  it("round trips every editable property through the same schema used by orders and quotations", () => {
    const c = normalizeCake(defaultCake()),
      o = c.objects![0];
    o.rotation = [0.1, 0.2, 0.3];
    o.scale = 1.8;
    o.material = "Gold";
    o.color = "#ccaabb";
    o.locked = true;
    c.tiers[0].position = [1, 0.5];
    c.tiers[1].spacing = 0.25;
    c.camera = { view: "Side", zoom: 2 };
    c.lettering!.topper.depth = 0.14;
    c.background!.exposure = 0.7;
    const loaded = deserializeCake(serializeCake(c));
    expect(loaded).toEqual(normalizeCake(c));
    expect(cakeSchema.parse(loaded)).toEqual(normalizeCake(c));
  });
  it("rejects duplicate IDs, missing attachments, invalid dimensions, and non-finite transforms", () => {
    const c = normalizeCake(defaultCake());
    c.objects![0].id = c.tiers[0].id;
    expect(() => deserializeCake(JSON.stringify(c))).toThrow(/unique/);
    c.objects![0].id = "object";
    c.objects![0].attachment.tierId = "missing";
    expect(() => deserializeCake(JSON.stringify(c))).toThrow(/missing tier/);
    c.tiers[0].diameter = -1;
    expect(cakeSchema.safeParse(c).success).toBe(false);
    c.tiers[0].diameter = 8;
    c.objects![0].rotation[0] = Infinity;
    expect(cakeSchema.safeParse(c).success).toBe(false);
  });
  it("keeps decorations at the same fractional tier height after stacking, resizing, and offsets", () => {
    const c = normalizeCake(defaultCake()),
      l = tierLayout(c)[1];
    const attachment = attachmentFromPoint(
      [l.radius, l.bottom + l.height * 0.7, 0],
      l,
      "Round",
      false,
    );
    c.tiers[0].height = 6;
    c.tiers[1].height = 7;
    c.tiers[1].diameter = 10;
    c.tiers[1].position = [1, -2];
    c.tiers[1].spacing = 0.5;
    const next = tierLayout(c)[1],
      p = attachmentPosition(attachment, next);
    expect(p[0]).toBeCloseTo(6 * UNIT);
    expect(p[1]).toBeCloseTo(next.bottom + next.height * 0.7);
    expect(p[2]).toBeCloseTo(-2 * UNIT);
  });
  it("surface placement round trips across round, square, custom, and heart profiles", () => {
    const c = normalizeCake(defaultCake()),
      l = tierLayout(c)[0];
    for (const shape of ["Round", "Square", "Custom", "Heart"] as const) {
      const a = {
        tierId: l.tier.id,
        surface: "top" as const,
        angle: 0.62,
        radius: 0.72,
        height: 1,
        offset: 0,
      };
      const p = attachmentPosition(a, l, shape),
        roundtrip = attachmentFromPoint(p, l, shape, true);
      expect(roundtrip.radius).toBeCloseTo(a.radius);
      expect(roundtrip.angle).toBeCloseTo(a.angle);
    }
  });
  it("removes only orphaned children when a tier is deleted and prices individual duplicates", () => {
    const c = normalizeCake(defaultCake()),
      id = c.tiers[1].id;
    c.tiers.splice(1, 1);
    const clean = normalizeCake(c);
    expect(clean.objects!.some((o) => o.attachment.tierId === id)).toBe(false);
    const before = calculatePrice(clean).cost;
    clean.objects!.push(...decorationGroup("rose-blush", clean.tiers[0].id, 2));
    expect(calculatePrice(clean).cost - before).toBe(120);
  });
  it("uses stable geometry with measurable edge bevels and non-planar handmade surfaces", () => {
    const tier = defaultCake().tiers[0],
      a = tierGeometry(tier, "Round", 1, 1),
      b = tierGeometry(tier, "Round", 1, 1);
    expect(Array.from(a.attributes.position.array)).toEqual(
      Array.from(b.attributes.position.array),
    );
    const p = a.attributes.position;
    let beveled = 0,
      imperfect = 0;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i)),
        y = p.getY(i);
      if (y > 0.005 && y < 0.03 && r > 0.97 && r < 0.999) beveled++;
      if (y > 0.1 && y < 0.9 && Math.abs(r - 1) > 0.0002) imperfect++;
    }
    expect(beveled).toBeGreaterThan(100);
    expect(imperfect).toBeGreaterThan(100);
    a.dispose();
    b.dispose();
  });
  it("flower meshes contain curved petals rather than planar disks", () => {
    const flower = flowerGeometry(0);
    flower.computeBoundingBox();
    const size = flower.boundingBox!.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(0.2);
    expect(flower.attributes.position.count).toBeGreaterThan(5000);
    expect(size.x).toBeGreaterThan(0.5);
    flower.dispose();
  });
  it("turns reviewed image estimates into ordinary independently editable cake objects", async () => {
    const c = await configurationFromAnalysis({
      method: "Test vision adapter",
      confidence: "medium",
      tiers: [
        { diameter: 10, height: 5, color: "#f3d7dd", frosting: "Buttercream" },
        { diameter: 7, height: 4, color: "#f3d7dd", frosting: "Buttercream" },
      ],
      decorations: [{ assetId: "rose-blush", tierIndex: 1, quantity: 3 }],
      topper: "Aisha",
      observations: ["Review dimensions"],
    });
    expect(c.sceneVersion).toBe(2);
    expect(c.objects).toHaveLength(3);
    expect(c.objects![0].attachment.tierId).toBe(c.tiers[1].id);
    expect(deserializeCake(serializeCake(c))).toEqual(c);
  });
});
