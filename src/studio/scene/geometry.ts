import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CakeConfig, Tier } from "../../domain/models";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import fontData from "../assets/helvetiker_regular.typeface.json";
import { seedValue, perimeterRadius } from "../../domain/cakeScene";

export function tierGeometry(
  tier: Tier,
  shape: CakeConfig["shape"],
  radius: number,
  height: number,
  number = "10",
) {
  const bevel = Math.min(0.055, (tier.frostingThickness ?? 0.16) * 0.27);
  if (shape === "Number") {
    const paths = new FontLoader()
      .parse(fontData)
      .generateShapes(number || "10", 1);
    const g = new THREE.ExtrudeGeometry(paths, {
      depth: height - 2 * bevel,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 5,
      curveSegments: 24,
    });
    g.computeBoundingBox();
    const box = g.boundingBox!,
      size = box.getSize(new THREE.Vector3());
    g.translate(
      -(box.max.x + box.min.x) / 2,
      -(box.max.y + box.min.y) / 2,
      bevel,
    );
    g.scale(
      (radius * 2) / Math.max(size.x, size.y),
      (radius * 2) / Math.max(size.x, size.y),
      1,
    );
    g.rotateX(-Math.PI / 2);
    g.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(
        new Float32Array(g.attributes.position.count * 3).fill(1),
        3,
      ),
    );
    g.computeVertexNormals();
    return g;
  }
  const points: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  // Dense top/bottom rings keep the frosting continuous across the softened edge.
  for (let i = 1; i <= 20; i++)
    points.push(new THREE.Vector2(((radius - bevel) * i) / 20, 0));
  for (let i = 1; i <= 8; i++) {
    const a = ((i / 8) * Math.PI) / 2;
    points.push(
      new THREE.Vector2(
        radius - bevel + bevel * Math.sin(a),
        bevel - bevel * Math.cos(a),
      ),
    );
  }
  for (let i = 1; i <= 52; i++)
    points.push(
      new THREE.Vector2(radius, bevel + ((height - 2 * bevel) * i) / 52),
    );
  for (let i = 1; i <= 8; i++) {
    const a = ((i / 8) * Math.PI) / 2;
    points.push(
      new THREE.Vector2(
        radius - bevel + bevel * Math.cos(a),
        height - bevel + bevel * Math.sin(a),
      ),
    );
  }
  for (let i = 19; i >= 0; i--)
    points.push(new THREE.Vector2(((radius - bevel) * i) / 20, height));
  const g = new THREE.LatheGeometry(points, 128);
  const p = g.attributes.position;
  const colors = [];
  const imperfection = tier.imperfection ?? 0.4;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const angle = Math.atan2(z, x),
      r = Math.hypot(x, z),
      side = r / radius;
    const factor = perimeterRadius(shape, 1, angle);
    const rough =
      tier.finish === "Rough" ? 4 : tier.finish === "Ruffled" ? 2.4 : 1;
    const undulation =
      imperfection *
      (0.0025 * Math.sin(angle * 11 + y * 8) +
        0.0018 * Math.sin(angle * 23 - y * 19) +
        0.001 * Math.sin(angle * 63 + y * 41)) *
      rough;
    const band =
      tier.finish === "Textured" || tier.finish === "Ruffled"
        ? 0.007 * Math.sin(y * 100 + Math.sin(angle * 3) * 0.6)
        : 0;
    if (r > 0.0001) {
      x *= factor + ((undulation + band) * side) / r;
      z *= factor + ((undulation + band) * side) / r;
    }
    y +=
      imperfection *
      0.004 *
      Math.sin(x * 12 + z * 9) *
      Math.sin(z * 16 - x * 4) *
      Math.pow(Math.abs(y / height - 0.5) * 2, 8);
    p.setXYZ(i, x, y, z);
    let shade =
      0.98 +
      0.018 * Math.sin(x * 23 + z * 17 + y * 11) * Math.sin(y * 34 - z * 21);
    const naked = tier.finish === "Naked" || tier.finish === "Semi-naked";
    if (naked && side > 0.95) {
      const sponge = Math.abs(Math.sin((y / height) * Math.PI * 3)) > 0.26;
      const exposed =
        tier.finish === "Naked" ||
        Math.sin(angle * 4 + y * 12) + Math.sin(angle * 9 - y * 9) > 0.15;
      if (sponge && exposed) {
        colors.push(0.57 * shade, 0.34 * shade, 0.15 * shade);
        continue;
      }
    }
    colors.push(shade, shade, shade);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Each petal is a separate cupped lamina. The scalloped lip, rolled edge and
// staggered height are important: concentric surfaces read as a lathed rosette.
export function petalGeometry(
  ring: number,
  index: number,
  count: number,
  variant: number,
) {
  const columns = 24,
    rows = 24,
    positions: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const seed = variant * 709 + ring * 37 + index * 13;
  const random = (n: number) => seedValue(seed + n);
  const theta =
    (index / count) * Math.PI * 2 + ring * 2.39996 + (random(1) - 0.5) * 0.3;
  const openness = variant === 1 ? 1.13 : variant === 2 ? 1.06 : 1;
  const radii = [0.355, 0.29, 0.225, 0.163, 0.105, 0.062, 0.032];
  const heights =
    variant === 1
      ? [0.17, 0.23, 0.28, 0.32, 0.35, 0.36, 0.35]
      : [0.23, 0.28, 0.32, 0.35, 0.37, 0.38, 0.36];
  const radius = radii[ring] * openness * (0.91 + random(2) * 0.18);
  const height = heights[ring] * (0.87 + random(3) * 0.24);
  const span = (Math.PI / count) * (1.4 + random(4) * 0.28);
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= columns; i++) {
      const u = (i / columns) * 2 - 1,
        v = j / rows;
      const rim = Math.pow(v, 7),
        edge = Math.abs(u);
      const shoulder = Math.sqrt(Math.max(0, 1 - u * u));
      // Broad rounded upper outline, narrow attached root, asymmetric folded lip.
      const width = Math.pow(Math.sin((v * Math.PI) / 2), 0.65) * span;
      const a =
        theta + u * width + 0.14 * Math.sin(v * 2.7 + random(5) * 4) * v;
      const flare = ring < 2 ? 0.095 : ring < 4 ? 0.025 : -0.015;
      const r =
        0.012 +
        radius * (0.36 * v + 0.64 * Math.sin((v * Math.PI) / 2)) +
        flare * rim * shoulder -
        radius * 0.2 * edge * edge * v;
      const wave =
        (Math.sin(u * 8 + seed) + 0.45 * Math.sin(u * 19 + seed * 2)) *
        (variant === 2 ? 0.012 : 0.007) *
        rim;
      const y =
        height * v * (0.67 + 0.33 * shoulder) +
        0.075 * Math.sin(v * Math.PI) * (ring < 3 ? 1 : 0.4) -
        (ring < 2 ? 0.05 : 0.018) * rim * shoulder +
        wave +
        (random(6) - 0.5) * 0.025 * u * v;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push(i / columns, v);
      // Baked root occlusion / pigment. This remains stable as the camera moves.
      const light = 0.34 + 0.66 * Math.pow(v, 0.65);
      const edgePale = 0.9 + 0.1 * Math.pow(v, 4);
      colors.push(light, light * edgePale, light * (0.95 + 0.05 * v));
      if (i < columns && j < rows) {
        const n = j * (columns + 1) + i;
        indices.push(
          n,
          n + columns + 1,
          n + 1,
          n + 1,
          n + columns + 1,
          n + columns + 2,
        );
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function flowerGeometry(variant = 0) {
  const petals: THREE.BufferGeometry[] = [];
  const counts = variant === 2 ? [8, 9, 8, 7, 5, 4, 3] : [5, 7, 7, 5, 4, 3, 2];
  counts.forEach((count, ring) => {
    for (let i = 0; i < count; i++)
      petals.push(petalGeometry(ring, i, count, variant));
  });
  const merged = mergeGeometries(petals)!;
  petals.forEach((g) => g.dispose());
  return merged;
}
export function leafGeometry() {
  const positions: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const cols = 20,
    rows = 40;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const v = j / rows,
        u = (i / cols) * 2 - 1;
      const width =
        Math.pow(Math.sin(Math.PI * v), 0.85) *
        0.078 *
        (1 + 0.035 * Math.sin(v * 160));
      const vein = Math.pow(
        Math.max(0, Math.cos(v * 58 - Math.abs(u) * 10)),
        16,
      );
      positions.push(
        u * width,
        0.085 * Math.sin(v * Math.PI) -
          Math.abs(u) * 0.04 * Math.sin(v * Math.PI) +
          0.003 * vein * Math.sin(Math.PI * v),
        v * 0.43,
      );
      uv.push(i / cols, v);
      const tone = 0.66 + 0.2 * vein + 0.14 * Math.pow(1 - Math.abs(u), 15);
      colors.push(tone, tone, tone * 0.92);
      if (i < cols && j < rows) {
        const n = j * (cols + 1) + i;
        indices.push(n, n + 1, n + cols + 1, n + 1, n + cols + 2, n + cols + 1);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// A torn, nearly two-dimensional foil flake, with tiny crinkles for reflections.
export function foilGeometry() {
  const positions = [0, 0.003, 0],
    indices: number[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = ((i % 14) / 14) * Math.PI * 2;
    const r = 0.018 + seedValue((i % 14) + 411) * 0.014;
    positions.push(
      Math.cos(a) * r,
      0.001 + seedValue((i % 14) + 32) * 0.011,
      Math.sin(a) * r,
    );
    if (i < 14) indices.push(0, i + 2, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  const creased = g.toNonIndexed();
  g.dispose();
  creased.computeVertexNormals();
  return creased;
}
export function dripGeometry(
  radius: number,
  height: number,
  shape: CakeConfig["shape"],
) {
  const positions = [],
    uv = [],
    indices = [],
    segments = 256;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const drops =
      Math.pow(Math.max(0, Math.cos(a * 17 + Math.sin(a * 5))), 12) *
      (0.13 + 0.13 * (0.5 + 0.5 * Math.sin(a * 7)));
    const depth = 0.025 + drops;
    const factor = perimeterRadius(shape, 1, a);
    for (let j = 0; j <= 8; j++) {
      const t = j / 8,
        r = (radius + 0.006 + 0.012 * Math.sin(t * Math.PI)) * factor;
      positions.push(
        Math.cos(a) * r,
        height - 0.012 - depth * t,
        Math.sin(a) * r,
      );
      uv.push(i / segments, t);
      if (i < segments && j < 8) {
        const n = i * 9 + j;
        indices.push(n, n + 9, n + 1, n + 1, n + 9, n + 10);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
