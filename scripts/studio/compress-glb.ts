import { MeshoptEncoder } from "meshoptimizer";
// Lossless EXT_meshopt_compression, with a required extension and a placeholder
// fallback buffer as specified by glTF. The runtime's useGLTF enables MeshoptDecoder.
export async function compressGLB(input: ArrayBuffer): Promise<Buffer> {
  await MeshoptEncoder.ready;
  const original = Buffer.from(input),
    jsonLength = original.readUInt32LE(12);
  const json = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
  const binary = original.subarray(28 + jsonLength),
    chunks: Buffer[] = [];
  let offset = 0,
    fallbackLength = 0;
  for (let i = 0; i < json.bufferViews.length; i++) {
    const view = json.bufferViews[i],
      accessor = json.accessors.find(
        (a: { bufferView: number }) => a.bufferView === i,
      );
    if (!accessor)
      throw new Error(
        "Only geometry buffer views are supported by this asset builder",
      );
    const sizes: Record<number, number> = {
        5121: 1,
        5123: 2,
        5125: 4,
        5126: 4,
      },
      components: Record<string, number> = {
        SCALAR: 1,
        VEC2: 2,
        VEC3: 3,
        VEC4: 4,
      };
    const stride =
        view.byteStride ||
        sizes[accessor.componentType] * components[accessor.type],
      count = view.byteLength / stride,
      mode = view.target === 34963 ? "TRIANGLES" : "ATTRIBUTES";
    const source = new Uint8Array(
      binary.buffer,
      binary.byteOffset + (view.byteOffset || 0),
      view.byteLength,
    );
    const compressed = Buffer.from(
      MeshoptEncoder.encodeGltfBuffer(source, count, stride, mode),
    );
    view.extensions = {
      EXT_meshopt_compression: {
        buffer: 0,
        byteOffset: offset,
        byteLength: compressed.length,
        byteStride: stride,
        count,
        mode,
        filter: "NONE",
      },
    };
    view.buffer = 1;
    view.byteOffset = fallbackLength;
    fallbackLength += view.byteLength;
    const padded = Buffer.alloc(Math.ceil(compressed.length / 4) * 4);
    compressed.copy(padded);
    chunks.push(padded);
    offset += padded.length;
  }
  json.buffers = [
    { byteLength: offset },
    {
      byteLength: fallbackLength,
      extensions: { EXT_meshopt_compression: { fallback: true } },
    },
  ];
  json.extensionsUsed = [
    ...(json.extensionsUsed || []),
    "EXT_meshopt_compression",
  ];
  json.extensionsRequired = [
    ...(json.extensionsRequired || []),
    "EXT_meshopt_compression",
  ];
  const text = Buffer.from(JSON.stringify(json)),
    paddedJson = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32);
  text.copy(paddedJson);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + paddedJson.length + offset, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(offset, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, paddedJson, binHeader, ...chunks]);
}
