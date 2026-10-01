import { MeshyProvider } from "./meshy";
import { TripoProvider } from "./tripo";
import type { Fetch, ImageTo3DProvider } from "./types";

// IMAGE_TO_3D_PROVIDER picks an adapter explicitly; otherwise the first one
// with a key is used. Returns null when nothing is configured — callers must
// report that instead of substituting a procedural cake.
export function createImageTo3DProvider(
  environment: NodeJS.ProcessEnv,
  fetchImpl?: Fetch,
): ImageTo3DProvider | null {
  const choice = (environment.IMAGE_TO_3D_PROVIDER || "").trim().toLowerCase();
  if ((!choice || choice === "meshy") && environment.MESHY_API_KEY)
    return new MeshyProvider(environment.MESHY_API_KEY, {
      baseUrl: environment.MESHY_API_BASE_URL || undefined,
      aiModel: environment.MESHY_AI_MODEL || undefined,
      targetPolycount: Number(environment.MESHY_TARGET_POLYCOUNT) || undefined,
      fetch: fetchImpl,
    });
  if ((!choice || choice === "tripo") && environment.TRIPO_API_KEY)
    return new TripoProvider(environment.TRIPO_API_KEY, {
      baseUrl: environment.TRIPO_API_BASE_URL || undefined,
      modelVersion: environment.TRIPO_MODEL_VERSION || undefined,
      fetch: fetchImpl,
    });
  return null;
}
