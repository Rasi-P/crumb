import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";

// Import pipeline for generated or uploaded GLBs. The source geometry and its
// materials are kept as delivered; this only measures the model, moves it into
// a normalized frame (footprint one unit wide, base at y = 0), and exposes
// whatever separable parts the file contains.
export type ModelPart = {
  key: string;
  name: string;
  meshes: {
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
    matrix: THREE.Matrix4;
  }[];
};
export type TierEstimate = {
  // Normalized units: fractions of the model's footprint width.
  base: number;
  tiers: { radius: number; height: number }[];
};
export type PreparedModel = {
  parts: ModelPart[];
  height: number;
  triangles: number;
  tiers: TierEstimate;
};

const MAX_PARTS = 24;

function copyAttribute(
  source: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertices: number[],
) {
  const size = source.itemSize,
    raw =
      !(source as THREE.InterleavedBufferAttribute)
        .isInterleavedBufferAttribute && !source.normalized;
  const array = raw
    ? new (source.array.constructor as new (n: number) => THREE.TypedArray)(
        vertices.length * size,
      )
    : new Float32Array(vertices.length * size);
  for (let i = 0; i < vertices.length; i++)
    for (let c = 0; c < size; c++)
      array[i * size + c] = raw
        ? source.array[vertices[i] * size + c]
        : source.getComponent(vertices[i], c);
  return new THREE.BufferAttribute(array, size);
}

// Splits one mesh into its disconnected surfaces. Image-to-3D services often
// return a single fused mesh, in which case this finds nothing and returns
// null; when a topper or flower is a separate shell it becomes its own part.
export function splitConnectedComponents(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  if (!position || geometry.groups.length > 1) return null;
  const index = geometry.getIndex(),
    triangles = (index ? index.count : position.count) / 3;
  if (triangles < 2) return null;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!,
    cell = Math.max(box.getSize(new THREE.Vector3()).length() * 1e-5, 1e-9);
  // Weld vertices that glTF duplicated along UV and normal seams.
  const welded = new Map<number, number>(),
    weldedOf = new Uint32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const key =
      Math.round((position.getX(i) - box.min.x) / cell) +
      Math.round((position.getY(i) - box.min.y) / cell) * 131071 +
      Math.round((position.getZ(i) - box.min.z) / cell) * 17179607041;
    let id = welded.get(key);
    if (id === undefined) welded.set(key, (id = welded.size));
    weldedOf[i] = id;
  }
  const parent = new Uint32Array(welded.size).map((_, i) => i);
  const find = (n: number) => {
    while (parent[n] !== n) n = parent[n] = parent[parent[n]];
    return n;
  };
  const corner = (n: number) => weldedOf[index ? index.getX(n) : n];
  for (let t = 0; t < triangles; t++) {
    const a = find(corner(t * 3));
    parent[find(corner(t * 3 + 1))] = a;
    parent[find(corner(t * 3 + 2))] = a;
  }
  const counts = new Map<number, number>();
  for (let t = 0; t < triangles; t++) {
    const root = find(corner(t * 3));
    counts.set(root, (counts.get(root) || 0) + 1);
  }
  const significant = [...counts.entries()]
    .filter(([, n]) => n >= Math.max(40, triangles * 0.004))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PARTS);
  if (significant.length < 2) return null;
  // Crumbs and stray fragments stay with the largest surface.
  const slot = new Map(significant.map(([root], i) => [root, i]));
  const buckets = significant.map(() => ({
    vertices: [] as number[],
    remap: new Map<number, number>(),
    indices: [] as number[],
  }));
  for (let t = 0; t < triangles; t++) {
    const bucket = buckets[slot.get(find(corner(t * 3))) ?? 0];
    for (let k = 0; k < 3; k++) {
      const vertex = index ? index.getX(t * 3 + k) : t * 3 + k;
      let mapped = bucket.remap.get(vertex);
      if (mapped === undefined) {
        bucket.remap.set(vertex, (mapped = bucket.vertices.length));
        bucket.vertices.push(vertex);
      }
      bucket.indices.push(mapped);
    }
  }
  return buckets.map((bucket) => {
    const part = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes))
      part.setAttribute(name, copyAttribute(attribute, bucket.vertices));
    part.setIndex(bucket.indices);
    return part;
  });
}

function partBounds(part: ModelPart) {
  const box = new THREE.Box3();
  for (const mesh of part.meshes) {
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix));
  }
  return box;
}

// Names for automatically separated shells, from where they sit. These are
// starting labels the baker can rename, not recognition of what the part is.
function nameParts(parts: ModelPart[], height: number) {
  const bounds = parts.map(partBounds),
    volume = (b: THREE.Box3) => {
      const s = b.getSize(new THREE.Vector3());
      return s.x * s.y * s.z;
    };
  const body = bounds.reduce(
    (best, b, i) => (volume(b) > volume(bounds[best]) ? i : best),
    0,
  );
  let decoration = 0;
  parts.forEach((part, i) => {
    const b = bounds[i],
      size = b.getSize(new THREE.Vector3());
    if (i === body) part.name = "Cake body";
    else if (
      b.min.y < 0.02 &&
      size.y < height * 0.12 &&
      Math.max(size.x, size.z) > 0.85
    )
      part.name = "Cake board";
    else if (b.min.y > bounds[body].max.y - height * 0.03) part.name = "Topper";
    else part.name = `Decoration ${++decoration}`;
  });
}

// Reads the stacked-cylinder structure off the silhouette: the radius at each
// height is the median reach across angular sectors, so a flower standing
// proud on one side does not widen the tier.
export function estimateTiers(
  parts: ModelPart[],
  height: number,
): TierEstimate {
  const slices = 96,
    sectors = 24,
    reach = new Float32Array(slices * sectors),
    point = new THREE.Vector3();
  for (const part of parts)
    for (const mesh of part.meshes) {
      const position = mesh.geometry.getAttribute("position"),
        step = Math.max(1, Math.floor(position.count / 150000));
      for (let i = 0; i < position.count; i += step) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix);
        const slice = Math.min(
            slices - 1,
            Math.max(0, Math.floor((point.y / height) * slices)),
          ),
          sector =
            Math.floor(
              ((Math.atan2(point.z, point.x) + Math.PI) / (Math.PI * 2)) *
                sectors,
            ) % sectors,
          r = Math.hypot(point.x, point.z);
        if (r > reach[slice * sectors + sector])
          reach[slice * sectors + sector] = r;
      }
    }
  const profile = Array.from({ length: slices }, (_, s) => {
    const row = [...reach.subarray(s * sectors, (s + 1) * sectors)]
      .filter((r) => r > 0)
      .sort((a, b) => a - b);
    return row.length >= sectors / 2 ? row[Math.floor(row.length / 2)] : 0;
  });
  // Plateaus of near-constant radius, bottom to top.
  const plateaus: { start: number; end: number; radius: number }[] = [];
  for (let s = 0; s < slices; s++) {
    const r = profile[s],
      current = plateaus.at(-1);
    if (
      current &&
      r > 0 &&
      Math.abs(r - current.radius) < current.radius * 0.09
    ) {
      current.radius =
        (current.radius * (current.end - current.start) + r) /
        (current.end - current.start + 1);
      current.end = s + 1;
    } else if (r > 0) plateaus.push({ start: s, end: s + 1, radius: r });
  }
  const tiers: (typeof plateaus)[number][] = [];
  for (const p of plateaus) {
    const span = (p.end - p.start) / slices,
      previous = tiers.at(-1);
    // Thin, wide slabs at the bottom are the board or stand, not cake.
    if (span < 0.1 || p.radius < 0.12) continue;
    if (previous && p.radius > previous.radius * 0.97) continue;
    tiers.push(p);
    if (tiers.length === 4) break;
  }
  if (!tiers.length)
    return { base: 0, tiers: [{ radius: 0.42, height: height * 0.9 }] };
  return {
    base: (tiers[0].start / slices) * height,
    tiers: tiers.map((t, i) => ({
      radius: t.radius,
      height: (((tiers[i + 1]?.start ?? t.end) - t.start) / slices) * height,
    })),
  };
}

export function prepareModel(
  root: THREE.Object3D,
  accelerate = true,
): PreparedModel {
  root.updateMatrixWorld(true);
  const sources: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (
      (o as THREE.Mesh).isMesh &&
      (o as THREE.Mesh).geometry.getAttribute("position")
    )
      sources.push(o as THREE.Mesh);
  });
  if (!sources.length)
    throw new Error("The model does not contain any geometry.");
  const box = new THREE.Box3();
  for (const mesh of sources) box.expandByObject(mesh, true);
  const size = box.getSize(new THREE.Vector3()),
    footprint = Math.max(size.x, size.z, 1e-6),
    center = box.getCenter(new THREE.Vector3());
  const normalize = new THREE.Matrix4()
    .makeScale(1 / footprint, 1 / footprint, 1 / footprint)
    .multiply(
      new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
    );
  const height = size.y / footprint;
  let parts: ModelPart[];
  const shells =
    sources.length === 1 ? splitConnectedComponents(sources[0].geometry) : null;
  if (shells) {
    const matrix = normalize.clone().multiply(sources[0].matrixWorld);
    parts = shells.map((geometry, i) => ({
      key: `shell-${i}`,
      name: "",
      meshes: [{ geometry, material: sources[0].material, matrix }],
    }));
    nameParts(parts, height);
  } else if (sources.length > 1) {
    // Parts the file already separates are preserved one to one.
    parts = sources.slice(0, MAX_PARTS - 1).map((mesh, i) => ({
      key: `mesh-${i}`,
      name: (mesh.name || mesh.parent?.name || `Part ${i + 1}`).slice(0, 100),
      meshes: [
        {
          geometry: mesh.geometry,
          material: mesh.material,
          matrix: normalize.clone().multiply(mesh.matrixWorld),
        },
      ],
    }));
    if (sources.length >= MAX_PARTS)
      parts.push({
        key: "rest",
        name: "Other details",
        meshes: sources.slice(MAX_PARTS - 1).map((mesh) => ({
          geometry: mesh.geometry,
          material: mesh.material,
          matrix: normalize.clone().multiply(mesh.matrixWorld),
        })),
      });
  } else
    parts = [
      {
        key: "whole",
        name: "Generated cake",
        meshes: [
          {
            geometry: sources[0].geometry,
            material: sources[0].material,
            matrix: normalize.clone().multiply(sources[0].matrixWorld),
          },
        ],
      },
    ];
  let triangles = 0;
  for (const part of parts)
    for (const mesh of part.meshes) {
      const g = mesh.geometry;
      triangles +=
        (g.getIndex()?.count ?? g.getAttribute("position").count) / 3;
      // Dragging a decoration raycasts this surface on every pointer move.
      if (accelerate && !g.boundsTree) g.boundsTree = new MeshBVH(g);
    }
  return { parts, height, triangles, tiers: estimateTiers(parts, height) };
}

const inches = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value * 2) / 2));

// Parametric stand-ins sized from the model. They stay hidden behind the
// generated mesh and drive servings, recipe and price until the baker
// corrects them.
export function tiersFromEstimate(estimate: TierEstimate, diameter: number) {
  return {
    base: Math.max(0, estimate.base * diameter),
    tiers: estimate.tiers.map((t) => ({
      diameter: inches(t.radius * 2 * diameter, 4, 16),
      height: inches(t.height * diameter, 2, 8),
    })),
  };
}
