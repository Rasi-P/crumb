export type ReferenceView = "front" | "left" | "back" | "right";

export type InputImage = {
  data: Buffer;
  mimeType: "image/jpeg" | "image/png";
  view: ReferenceView;
};

export type GenerationJob = { id: string };

export type GenerationStatus = {
  state: "queued" | "running" | "succeeded" | "failed";
  // 0–100 as reported by the provider.
  progress: number;
  error?: string;
};

export type ModelResult = {
  modelUrl: string;
  format: "glb";
};

// The rest of the application depends only on this interface. Job IDs are
// opaque to callers; each provider encodes whatever it needs to resume a job.
export interface ImageTo3DProvider {
  readonly maxViews: number;
  createFromImage(input: { image: InputImage }): Promise<GenerationJob>;
  createFromMultiView(input: { images: InputImage[] }): Promise<GenerationJob>;
  getStatus(jobId: string): Promise<GenerationStatus>;
  getResult(jobId: string): Promise<ModelResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

export type Fetch = typeof fetch;

export async function providerRequest(
  fetchImpl: Fetch,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ProviderError(
      "The image-to-3D service could not be reached. Please try again.",
      504,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body;
  const detail =
    body && typeof body === "object" && "message" in body
      ? String(body.message).slice(0, 300)
      : "";
  if (response.status === 401 || response.status === 403)
    throw new ProviderError(
      "The image-to-3D service rejected the configured API key.",
    );
  if (response.status === 402)
    throw new ProviderError(
      "The image-to-3D account has no remaining credits.",
      402,
    );
  if (response.status === 429)
    throw new ProviderError(
      "The image-to-3D service is busy. Please try again in a minute.",
      429,
    );
  if (response.status === 404)
    throw new ProviderError("This generation job no longer exists.", 404);
  throw new ProviderError(
    `The image-to-3D service returned an error${detail ? `: ${detail}` : "."}`,
    response.status >= 500 ? 502 : 400,
  );
}
