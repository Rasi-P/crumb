import { compressGLB } from "./compress-glb";
import "./build-font";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { writeFileSync } from "node:fs";
import { flowerGeometry, leafGeometry } from "../../src/studio/scene/geometry";
// GLTFExporter uses FileReader in browsers. Only local generated buffers are read here.
(globalThis as any).FileReader = class {
  result: ArrayBuffer | string | null = null;
  onloadend?: () => void;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
for (const [i, name] of ["garden-rose", "open-rose", "peony"].entries()) {
  const group = new THREE.Group();
  const petals = new THREE.Mesh(
    flowerGeometry(i),
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.48,
      metalness: 0,
      sheen: 0.2,
      sheenColor: new THREE.Color("#ffe4df"),
    }),
  );
  petals.name = "Petals";
  group.add(petals);
  for (let j = 0; j < 2; j++) {
    const leaf = new THREE.Mesh(
      leafGeometry(),
      new THREE.MeshStandardMaterial({
        color: j % 2 ? "#68794e" : "#415839",
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.72,
      }),
    );
    leaf.rotation.y = -0.6 + j * 2.5;
    leaf.rotation.x = -0.24 + j * 0.13;
    leaf.scale.setScalar(1.1 + j * 0.1);
    leaf.position.set(Math.sin(j) * 0.09, -0.02, Math.cos(j) * 0.09);
    leaf.name = "Leaf";
    group.add(leaf);
  }
  const glb = await new GLTFExporter().parseAsync(group, { binary: true });
  writeFileSync(
    `public/assets/flowers/${name}.glb`,
    await compressGLB(glb as ArrayBuffer),
  );
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
}
// Radiance RGBE studio environment. Linear values >1 preserve softbox dynamic range.
const width = 256,
  height = 128,
  header = Buffer.from(
    `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`,
  ),
  pixels = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const u = x / width,
      v = y / height;
    const box = (
      cx: number,
      cy: number,
      wx: number,
      wy: number,
      power: number,
    ) =>
      power *
      Math.exp(-Math.pow((u - cx) / wx, 8) - Math.pow((v - cy) / wy, 8));
    const key = box(0.64, 0.34, 0.09, 0.16, 7),
      fill = box(0.77, 0.44, 0.14, 0.24, 2.5) + box(0.19, 0.4, 0.08, 0.2, 1.2),
      rim = box(0.91, 0.28, 0.06, 0.14, 4);
    const ambient = 0.16 + 0.2 * Math.sin(v * Math.PI),
      r = ambient + key + fill * 0.95 + rim,
      g = ambient * 0.96 + key * 0.94 + fill + rim * 0.97,
      b = ambient * 0.91 + key * 0.86 + fill * 1.05 + rim * 0.93,
      max = Math.max(r, g, b),
      exp = Math.ceil(Math.log2(max)),
      factor = 256 / Math.pow(2, exp),
      n = (y * width + x) * 4;
    pixels[n] = Math.min(255, r * factor);
    pixels[n + 1] = Math.min(255, g * factor);
    pixels[n + 2] = Math.min(255, b * factor);
    pixels[n + 3] = exp + 128;
  }
writeFileSync(
  "public/assets/materials/cake-studio.hdr",
  Buffer.concat([header, pixels]),
);
writeFileSync(
  "public/assets/flowers/rose.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="#f5eeea"/><g fill="#eac1c7" stroke="#ca979f" stroke-width=".7"><path d="M40 12C62 7 77 33 64 54C55 77 24 72 14 51C3 29 22 9 40 12Z"/><path d="M37 20C56 14 67 31 57 49C51 67 26 59 22 43C16 29 27 18 37 20Z"/><path d="M40 27C55 23 57 46 44 51C29 57 23 36 34 29Z"/><path d="M39 32C52 33 47 47 38 44C31 43 34 35 42 37"/></g></svg>',
);
console.log("Built 3 flower GLBs and a local HDR studio environment.");
