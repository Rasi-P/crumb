import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { defaultCake } from "../src/domain/seed";
import {
  cakeSchema,
  type CakeConfig,
  type GeneratedModel,
} from "../src/domain/models";
import {
  attachmentFromPoint,
  attachmentPosition,
  decorationGroup,
  deserializeCake,
  makeObject,
  modelAttachmentPosition,
  modelDirectionToWorld,
  modelPointToWorld,
  normalizeCake,
  rotateAboutNormal,
  serializeCake,
  tierIdOf,
  tierLayout,
  UNIT,
  variedCopy,
  worldDirectionToModel,
  worldPointToModel,
} from "../src/domain/cakeScene";
import { calculatePrice } from "../src/domain/pricing";
import { tierGeometry, flowerGeometry } from "../src/studio/scene/geometry";
import {
  estimateTiers,
  prepareModel,
  splitConnectedComponents,
  tiersFromEstimate,
} from "../src/studio/scene/modelAnalysis";
import { placementOf } from "../src/studio/scene/placement";
import { duplicateSelection, removeSelection } from "../src/studio/sceneEdits";

const generatedModel = (
  patch: Partial<GeneratedModel> = {},
): GeneratedModel => ({
  id: "model-1",
  name: "Generated cake",
  url: "/api/studio/assets/0123456789abcdef0123456789abcdef",
  source: "generated",
  diameter: 8,
  height: 1.1,
  position: [0, 0, 0],
  rotation: 0,
  hidden: false,
  locked: false,
  ...patch,
});
// A generated-model cake: the mesh is shown, its tiers are hidden stand-ins,
// and one rose is attached to the mesh surface.
function hybridCake(): CakeConfig {
  const c = normalizeCake({ ...defaultCake(), text: "", topper: "" });
  c.objects = [
    {
      ...makeObject("rose-blush", c.tiers[0].id, 7, "rose-1"),
      attachment: {
        surface: "model",
        modelId: "model-1",
        point: [0.4, 0.5, 0],
        normal: [1, 0, 0],
        offset: 0,
      },
    },
  ];
  c.tiers = c.tiers.map((t) => ({ ...t, hidden: true }));
  c.board = { ...c.board!, hidden: true };
  c.generatedModels = [generatedModel()];
  c.referenceImages = [
    {
      id: "ref-1",
      url: "/api/studio/assets/fedcba9876543210fedcba9876543210",
      view: "front",
    },
  ];
  return c;
}
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
    (c.objects![0].attachment as { tierId: string }).tierId = "missing";
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
    expect(clean.objects!.some((o) => tierIdOf(o) === id)).toBe(false);
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
});

describe("generated models and surface attachment", () => {
  it("keeps a decoration on the same spot of the mesh when the model is resized, moved, or turned", () => {
    const c = hybridCake(),
      a = c.objects![0].attachment;
    if (a.surface !== "model") throw new Error("expected a model attachment");
    const before = modelAttachmentPosition(a, c.generatedModels![0]);
    expect(before[0]).toBeCloseTo(0.4 * 8 * UNIT);
    expect(before[1]).toBeCloseTo(0.5 * 8 * UNIT);
    const moved = generatedModel({
        diameter: 12,
        position: [2, 1, -3],
        rotation: Math.PI / 2,
      }),
      after = modelAttachmentPosition(a, moved);
    // A quarter turn about Y carries local +X to world -Z.
    expect(after[0]).toBeCloseTo(2 * UNIT);
    expect(after[1]).toBeCloseTo((1 + 0.5 * 12) * UNIT);
    expect(after[2]).toBeCloseTo((-3 - 0.4 * 12) * UNIT);
    expect(worldPointToModel(moved, modelPointToWorld(moved, a.point))).toEqual(
      a.point.map((v) => expect.closeTo(v, 9)),
    );
    expect(
      worldDirectionToModel(moved, modelDirectionToWorld(moved, a.normal)),
    ).toEqual(a.normal.map((v) => expect.closeTo(v, 9)));
  });
  it("orients a decoration along the surface normal and applies a free-transform offset", () => {
    const c = hybridCake(),
      context = {
        layouts: tierLayout(c),
        models: c.generatedModels!,
        shape: c.shape,
      },
      placement = placementOf(c.objects![0], context)!;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(placement.quaternion);
    expect(up.x).toBeCloseTo(1);
    expect(up.y).toBeCloseTo(0);
    const lifted = placementOf(
      { ...c.objects![0], nudge: [0, 2, 0] },
      context,
    )!;
    expect(lifted.position.y - placement.position.y).toBeCloseTo(2 * UNIT);
    // A hidden parent hides what is attached to it.
    expect(
      placementOf(c.objects![0], {
        ...context,
        models: [generatedModel({ hidden: true })],
      }),
    ).toBeNull();
  });
  it("saves and reloads the generated model, reference image, and attachments exactly", () => {
    const c = hybridCake();
    c.objects![0].nudge = [0.5, 0, -0.25];
    c.generatedModels![0].parts = [
      { key: "shell-0", name: "Cake body", hidden: false },
      { key: "shell-1", name: "Topper", hidden: true },
    ];
    const loaded = deserializeCake(serializeCake(c));
    expect(loaded).toEqual(normalizeCake(c));
    expect(loaded.generatedModels![0].url).toBe(c.generatedModels![0].url);
    expect(loaded.objects![0].attachment).toEqual(c.objects![0].attachment);
    expect(loaded.referenceImages).toEqual(c.referenceImages);
    // Hidden stand-in tiers still carry the price.
    expect(calculatePrice(loaded).cost).toBe(calculatePrice(c).cost);
  });
  it("rejects attachments to a missing model and asset links outside the studio store", () => {
    const c = hybridCake();
    c.generatedModels![0].id = "another";
    expect(() => deserializeCake(JSON.stringify(c))).toThrow(/missing model/);
    const external = hybridCake();
    external.generatedModels![0].url = "https://example.com/model.glb";
    expect(cakeSchema.safeParse(external).success).toBe(false);
  });
  it("rotates about the surface normal exactly as the renderer composes rotations", () => {
    for (const rotation of [
      [0, 0, 0],
      [0.4, 0, -0.2],
      [0.85, -0.2, 0.2],
      [-1.2, 2.4, 0.7],
    ] as [number, number, number][]) {
      const expected = new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.7)
          .multiply(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
          ),
        actual = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...rotateAboutNormal(rotation, 0.7)),
        );
      expect(Math.abs(actual.dot(expected))).toBeCloseTo(1, 6);
    }
  });
  it("duplicates into independent, slightly varied objects and deletes only what is selected", () => {
    const c = hybridCake(),
      rose = c.objects![0],
      copy = variedCopy(rose, 99);
    expect(copy.id).not.toBe(rose.id);
    expect(copy.seed).not.toBe(rose.seed);
    expect(copy.rotation).not.toEqual(rose.rotation);
    expect(copy.scale / rose.scale).toBeGreaterThan(0.95);
    expect(copy.scale / rose.scale).toBeLessThan(1.05);
    const beside = {
      surface: "model" as const,
      modelId: "model-1",
      point: [0.39, 0.5, 0.05] as [number, number, number],
      normal: [1, 0, 0] as [number, number, number],
      offset: 0,
    };
    const doubled = duplicateSelection(c, [rose.id], () => beside);
    expect(doubled.config.objects).toHaveLength(2);
    expect(doubled.config.objects![1].attachment).toEqual(beside);
    // Moving the duplicate leaves the original where it was.
    doubled.config.objects![1].attachment = { ...beside, point: [0, 1, 0] };
    expect(doubled.config.objects![0].attachment).toEqual(rose.attachment);
    const removed = removeSelection(doubled.config, doubled.created);
    expect(removed.objects!.map((o) => o.id)).toEqual([rose.id]);
    rose.locked = true;
    expect(removeSelection(c, [rose.id]).objects).toHaveLength(1);
  });
  it("hides a deleted model part, and restores the parametric cake when the model is removed", () => {
    const c = hybridCake();
    c.generatedModels![0].parts = [
      { key: "shell-0", name: "Cake body", hidden: false },
      { key: "shell-1", name: "Topper", hidden: false },
    ];
    const withoutTopper = removeSelection(c, ["model-1/shell-1"]);
    expect(withoutTopper.generatedModels![0].parts![1].hidden).toBe(true);
    expect(withoutTopper.generatedModels).toHaveLength(1);
    const withoutModel = cakeSchema.parse(removeSelection(c, ["model-1"]));
    expect(withoutModel.generatedModels).toEqual([]);
    expect(withoutModel.objects).toEqual([]);
    expect(withoutModel.tiers.every((t) => !t.hidden)).toBe(true);
    expect(withoutModel.board!.hidden).toBe(false);
  });
});

// A stand-in for provider output: two stacked tiers fused into one mesh on a
// board, plus a topper that is a separate shell of the same mesh.
function fusedCakeScene() {
  const tier = (radius: number, height: number, y: number) =>
    new THREE.CylinderGeometry(radius, radius, height, 48, 12).translate(
      0,
      y + height / 2,
      0,
    );
  const parts = [
    tier(2.6, 0.1, 0),
    tier(2, 1.6, 0.1),
    tier(1.3, 1.4, 1.7),
    new THREE.SphereGeometry(0.3, 16, 12).translate(0, 3.6, 0),
  ];
  // Board and tiers touch, so welding joins them; the sphere floats free.
  const positions: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  for (const g of parts) {
    const offset = positions.length / 3;
    positions.push(...g.getAttribute("position").array);
    normals.push(...g.getAttribute("normal").array);
    indices.push(...[...g.getIndex()!.array].map((i) => i + offset));
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  const scene = new THREE.Group(),
    mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial());
  // Providers deliver arbitrary scale and origin; import must not depend on it.
  mesh.position.set(40, -7, 3);
  mesh.scale.setScalar(25);
  scene.add(mesh);
  return scene;
}
describe("generated model import", () => {
  it("normalizes any source scale to a unit footprint resting on y = 0 without altering geometry", () => {
    const scene = fusedCakeScene(),
      source = (scene.children[0] as THREE.Mesh).geometry,
      model = prepareModel(scene);
    expect(model.height).toBeCloseTo(3.9 / 5.2, 2);
    const box = new THREE.Box3();
    let triangles = 0;
    for (const part of model.parts)
      for (const mesh of part.meshes) {
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix));
        triangles += mesh.geometry.getIndex()!.count / 3;
      }
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.x - box.min.x).toBeCloseTo(1);
    expect((box.max.x + box.min.x) / 2).toBeCloseTo(0);
    // Every source triangle is still there: nothing was simplified away.
    expect(triangles).toBe(source.getIndex()!.count / 3);
    expect(model.triangles).toBe(triangles);
  });
  it("separates disconnected shells into selectable parts and keeps a fused mesh whole", () => {
    const model = prepareModel(fusedCakeScene());
    expect(model.parts.map((p) => p.name)).toEqual(["Cake body", "Topper"]);
    expect(new Set(model.parts.map((p) => p.key)).size).toBe(2);
    const fused = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 4));
    expect(splitConnectedComponents(fused.geometry)).toBeNull();
    const whole = prepareModel(new THREE.Group().add(fused));
    expect(whole.parts).toHaveLength(1);
    expect(whole.parts[0].key).toBe("whole");
  });
  it("preserves parts the file already separates", () => {
    const scene = new THREE.Group(),
      body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32)),
      flower = new THREE.Mesh(new THREE.SphereGeometry(0.2));
    body.name = "cake";
    flower.name = "flower_01";
    flower.position.set(1, 0.3, 0);
    scene.add(body, flower);
    const model = prepareModel(scene);
    expect(model.parts.map((p) => p.name)).toEqual(["cake", "flower_01"]);
    expect(model.parts[0].meshes[0].geometry).toBe(body.geometry);
  });
  it("raycasts the prepared surface through its acceleration structure", async () => {
    const { acceleratedRaycast } = await import("three-mesh-bvh");
    const model = prepareModel(fusedCakeScene()),
      source = model.parts[0].meshes[0],
      mesh = new THREE.Mesh(source.geometry, source.material);
    mesh.raycast = acceleratedRaycast;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(source.matrix);
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(5, 0.2, 0),
      new THREE.Vector3(-1, 0, 0),
    );
    ray.firstHitOnly = true;
    const hit = ray.intersectObject(mesh)[0];
    // Bottom tier: radius 2 of a 5.2-wide footprint.
    expect(hit.point.x).toBeCloseTo(2 / 5.2, 2);
    expect(source.geometry.boundsTree).toBeDefined();
  });
  it("estimates stacked tiers from the silhouette for sizing and pricing", () => {
    const model = prepareModel(fusedCakeScene()),
      estimate = estimateTiers(model.parts, model.height);
    expect(estimate.tiers).toHaveLength(2);
    expect(estimate.tiers[0].radius).toBeCloseTo(2 / 5.2, 1);
    expect(estimate.tiers[1].radius).toBeCloseTo(1.3 / 5.2, 1);
    // A 10.4 in wide model is twice the fixture: 8 in and 5 in tiers.
    const sized = tiersFromEstimate(estimate, 10.4);
    expect(sized.tiers[0].diameter).toBeCloseTo(8, 0);
    expect(sized.tiers[1].diameter).toBeCloseTo(5, 0);
    expect(sized.tiers[0].height).toBeGreaterThanOrEqual(3);
    expect(sized.tiers[0].height).toBeLessThanOrEqual(3.5);
    expect(sized.base).toBeLessThan(0.5);
  });
});
