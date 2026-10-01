import { ProviderError, type Fetch } from "./types";

// Structural validation of a binary glTF 2.0 container before it is stored or
// handed to the browser. Mesh content is left untouched.
export function validateGlb(data: Buffer) {
  if (data.length < 20 || data.readUInt32LE(0) !== 0x46546c67)
    throw new ProviderError("The model is not a binary glTF (GLB) file.", 422);
  if (data.readUInt32LE(4) !== 2)
    throw new ProviderError("Only glTF 2.0 models are supported.", 422);
  if (data.readUInt32LE(8) !== data.length)
    throw new ProviderError("The model file is incomplete.", 422);
  const jsonLength = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== 0x4e4f534a || 20 + jsonLength > data.length)
    throw new ProviderError("The model file is malformed.", 422);
  let json: {
    asset?: { version?: string };
    meshes?: unknown[];
    extensionsRequired?: string[];
  };
  try {
    json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  } catch {
    throw new ProviderError("The model file is malformed.", 422);
  }
  if (!json.asset?.version?.startsWith("2.") || !json.meshes?.length)
    throw new ProviderError("The model does not contain any geometry.", 422);
  const unsupported = (json.extensionsRequired || []).filter(
    (name) =>
      ![
        "KHR_draco_mesh_compression",
        "EXT_meshopt_compression",
        "KHR_mesh_quantization",
        "KHR_texture_transform",
        "KHR_materials_unlit",
        "EXT_texture_webp",
      ].includes(name),
  );
  if (unsupported.length)
    throw new ProviderError(
      `The model needs an unsupported glTF extension (${unsupported[0]}).`,
      422,
    );
  return { meshes: json.meshes.length };
}

export async function downloadModel(
  fetchImpl: Fetch,
  url: string,
  options: { maxBytes: number; allowInsecure: boolean },
) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProviderError("The generated model link is not valid.");
  }
  if (
    parsed.protocol !== "https:" &&
    !(options.allowInsecure && parsed.protocol === "http:")
  )
    throw new ProviderError("The generated model link is not valid.");
  let response: Response;
  try {
    response = await fetchImpl(parsed, { signal: AbortSignal.timeout(25000) });
  } catch {
    throw new ProviderError(
      "The generated model could not be downloaded. Please try again.",
      504,
    );
  }
  if (!response.ok || !response.body)
    throw new ProviderError("The generated model could not be downloaded.");
  if (Number(response.headers.get("content-length")) > options.maxBytes)
    throw new ProviderError("The generated model is too large to store.", 413);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > options.maxBytes)
      throw new ProviderError(
        "The generated model is too large to store.",
        413,
      );
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
