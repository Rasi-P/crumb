import type { ReferenceImage } from "../../domain/models";

// Browser side of the image-to-3D pipeline. It talks only to this
// application's own endpoints and has no knowledge of which generation
// service the server is connected to.
export type ReferenceView = ReferenceImage["view"];
export type GenerationProgress = {
  state: "preparing" | "queued" | "running" | "importing";
  progress: number;
};
export type GenerationResult = {
  modelUrl: string;
  referenceImages: ReferenceImage[];
};
type PendingJob = {
  jobId: string;
  referenceImages: ReferenceImage[];
  startedAt: number;
};

const pendingKey = "crumb-image-to-3d-job";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/studio/${path}`, init),
    body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(body?.error || "The studio service did not respond.");
  return body as T;
}

export function getImageTo3DStatus(signal?: AbortSignal) {
  return api<{ configured: boolean; maxViews: number }>("image-to-3d", {
    signal,
  });
}

// Applies the photo's own orientation, limits it to a size generation
// services accept, and flattens transparency onto white. Subject isolation
// (background removal) is performed by the generation service itself.
export async function prepareImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG, or WebP photograph.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose a photograph smaller than 20 MB.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => {
    throw new Error("This photograph could not be read.");
  });
  if (Math.min(bitmap.width, bitmap.height) < 256) {
    bitmap.close();
    throw new Error("Choose a photograph at least 256 pixels on each side.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

async function follow(
  job: PendingJob,
  signal: AbortSignal,
  onProgress: (p: GenerationProgress) => void,
): Promise<GenerationResult> {
  let failures = 0;
  for (;;) {
    signal.throwIfAborted();
    if (Date.now() - job.startedAt > 20 * 60 * 1000) {
      localStorage.removeItem(pendingKey);
      throw new Error("Generation is taking too long. Please try again.");
    }
    let status: {
      state: "queued" | "running" | "succeeded" | "failed";
      progress: number;
      error?: string;
      model?: { url: string };
    };
    try {
      status = await api(`image-to-3d/jobs/${job.jobId}`, { signal });
      failures = 0;
    } catch (error) {
      signal.throwIfAborted();
      // A dropped poll is not a failed generation; the job continues remotely.
      if (++failures >= 5) {
        localStorage.removeItem(pendingKey);
        throw error;
      }
      await wait(4000, signal);
      continue;
    }
    if (status.state === "failed") {
      localStorage.removeItem(pendingKey);
      throw new Error(
        status.error || "The image could not be turned into a 3D model.",
      );
    }
    if (status.state === "succeeded" && status.model) {
      localStorage.removeItem(pendingKey);
      return {
        modelUrl: status.model.url,
        referenceImages: job.referenceImages,
      };
    }
    onProgress({
      state: status.state === "queued" ? "queued" : "running",
      progress: status.progress,
    });
    await wait(3000, signal);
  }
}

export async function generateModel(
  images: { view: ReferenceView; file: File }[],
  signal: AbortSignal,
  onProgress: (p: GenerationProgress) => void,
) {
  onProgress({ state: "preparing", progress: 0 });
  const prepared = await Promise.all(
    images.map(async (i) => ({
      view: i.view,
      data: await prepareImage(i.file),
    })),
  );
  signal.throwIfAborted();
  const created = await api<Omit<PendingJob, "startedAt">>("image-to-3d/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: prepared }),
    signal,
  });
  const job = { ...created, startedAt: Date.now() };
  // Generation is paid for once it starts; remember it so closing the dialog
  // or reloading the page does not lose the result.
  localStorage.setItem(pendingKey, JSON.stringify(job));
  onProgress({ state: "queued", progress: 0 });
  return follow(job, signal, onProgress);
}

export function pendingGeneration(): PendingJob | null {
  try {
    const job = JSON.parse(localStorage.getItem(pendingKey) || "null");
    return job?.jobId && Date.now() - job.startedAt < 20 * 60 * 1000
      ? job
      : null;
  } catch {
    return null;
  }
}
export function resumeGeneration(
  job: PendingJob,
  signal: AbortSignal,
  onProgress: (p: GenerationProgress) => void,
) {
  onProgress({ state: "running", progress: 0 });
  return follow(job, signal, onProgress);
}
export const forgetPendingGeneration = () =>
  localStorage.removeItem(pendingKey);

export async function importModelFile(file: File, signal?: AbortSignal) {
  if (!file.name.toLowerCase().endsWith(".glb"))
    throw new Error("Choose a binary glTF (.glb) model.");
  const { url } = await api<{ url: string }>("assets", {
    method: "POST",
    headers: { "Content-Type": "model/gltf-binary" },
    body: file,
    signal,
  });
  return url;
}
