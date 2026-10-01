import * as THREE from "three";

// A small stand-in for image-to-3D output, built in memory for the tests: a
// two-tier cake on a board as ONE fused surface (as generators deliver it),
// with a few flower-sized shells that are separate surfaces of the same mesh.
export function buildCakeGlb() {
  const profile = [
    [0, 0],
    [1.5, 0],
    [1.5, 0.08],
    [1.15, 0.09],
    [1.15, 1.02],
    [1.1, 1.08],
    [0.74, 1.09],
    [0.72, 1.12],
    [0.72, 1.9],
    [0.67, 1.96],
    [0, 1.96],
  ];
  const points = [];
  for (let i = 0; i < profile.length - 1; i++)
    for (let k = 0; k < 6; k++)
      points.push(
        new THREE.Vector2(
          profile[i][0] + ((profile[i + 1][0] - profile[i][0]) * k) / 6,
          profile[i][1] + ((profile[i + 1][1] - profile[i][1]) * k) / 6,
        ),
      );
  points.push(new THREE.Vector2(0, 1.96));
  const tint = (geometry, color) => {
    const c = new THREE.Color(color),
      n = geometry.getAttribute("position").count,
      colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(colors, i * 3);
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  };
  const cake = tint(new THREE.LatheGeometry(points, 72), "#f0c9d2");
  // The board ring of the lathe gets a lighter colour.
  const p = cake.getAttribute("position"),
    colors = cake.getAttribute("color");
  for (let i = 0; i < p.count; i++)
    if (p.getY(i) < 0.085 && Math.hypot(p.getX(i), p.getZ(i)) > 1.16)
      colors.setXYZ(i, 0.95, 0.94, 0.92);
  const blossoms = [
    [1.17, 0.62, 0.25],
    [0.3, 2.0, 0.2],
    [-0.76, 1.5, 0.1],
  ].map(([x, y, z]) =>
    tint(
      new THREE.IcosahedronGeometry(0.17, 2)
        .scale(1, 0.75, 1)
        .translate(x, y, z),
      "#c9486b",
    ),
  );
  const position = [],
    normal = [],
    color = [],
    index = [];
  for (const source of [cake, ...blossoms]) {
    const g = source,
      offset = position.length / 3;
    position.push(...g.getAttribute("position").array);
    normal.push(...g.getAttribute("normal").array);
    color.push(...g.getAttribute("color").array);
    if (g.index) index.push(...[...g.index.array].map((i) => i + offset));
    else
      for (let i = 0; i < g.getAttribute("position").count; i++)
        index.push(i + offset);
  }
  const buffers = [
      new Float32Array(position),
      new Float32Array(normal),
      new Float32Array(color),
      new Uint32Array(index),
    ],
    min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.length; i++) {
    min[i % 3] = Math.min(min[i % 3], position[i]);
    max[i % 3] = Math.max(max[i % 3], position[i]);
  }
  let byteOffset = 0;
  const bufferViews = buffers.map((b, i) => {
    const view = {
      buffer: 0,
      byteOffset,
      byteLength: b.byteLength,
      target: i === 3 ? 34963 : 34962,
    };
    byteOffset += b.byteLength;
    return view;
  });
  const json = Buffer.from(
      JSON.stringify({
        asset: { version: "2.0", generator: "crumb-e2e-fixture" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        // Arbitrary scale and origin, as a generation service would deliver.
        nodes: [
          {
            mesh: 0,
            name: "generated",
            scale: [3, 3, 3],
            translation: [4, -2, 1],
          },
        ],
        meshes: [
          {
            primitives: [
              {
                attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
                indices: 3,
                material: 0,
              },
            ],
          },
        ],
        materials: [
          {
            pbrMetallicRoughness: {
              baseColorFactor: [1, 1, 1, 1],
              metallicFactor: 0,
              roughnessFactor: 0.72,
            },
          },
        ],
        accessors: [
          {
            bufferView: 0,
            componentType: 5126,
            count: position.length / 3,
            type: "VEC3",
            min,
            max,
          },
          {
            bufferView: 1,
            componentType: 5126,
            count: normal.length / 3,
            type: "VEC3",
          },
          {
            bufferView: 2,
            componentType: 5126,
            count: color.length / 3,
            type: "VEC3",
          },
          {
            bufferView: 3,
            componentType: 5125,
            count: index.length,
            type: "SCALAR",
          },
        ],
        bufferViews,
        buffers: [{ byteLength: byteOffset }],
      }),
    ),
    jsonChunk = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(jsonChunk);
  const bin = Buffer.concat(
      buffers.map((b) => Buffer.from(b.buffer, b.byteOffset, b.byteLength)),
    ),
    header = Buffer.alloc(12),
    jsonHeader = Buffer.alloc(8),
    binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + jsonChunk.length + bin.length, 8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
}
