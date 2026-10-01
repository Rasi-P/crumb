import {
  ProviderError,
  providerRequest,
  type Fetch,
  type GenerationStatus,
  type ImageTo3DProvider,
  type InputImage,
  type ReferenceView,
} from "./types";

type TripoTask = {
  status?: string;
  progress?: number;
  output?: { pbr_model?: string; model?: string; base_model?: string };
};

const taskId = /^[A-Za-z0-9-]{8,64}$/;
// Tripo's multiview task takes exactly this order; absent views are sent as {}.
const viewOrder: ReferenceView[] = ["front", "left", "back", "right"];

// Written against Tripo's published v2 OpenAPI (upload → task → poll) as used
// by the official Python SDK. It has not been exercised with a live key here.
export class TripoProvider implements ImageTo3DProvider {
  readonly maxViews = 4;
  constructor(
    private readonly apiKey: string,
    private readonly options: {
      baseUrl?: string;
      modelVersion?: string;
      fetch?: Fetch;
    } = {},
  ) {}
  private async request(path: string, init: RequestInit = {}) {
    const body = (await providerRequest(
      this.options.fetch ?? fetch,
      `${this.options.baseUrl ?? "https://api.tripo3d.ai"}/v2/openapi/${path}`,
      {
        ...init,
        headers: { Authorization: `Bearer ${this.apiKey}`, ...init.headers },
      },
    )) as { code?: number; message?: string; data?: unknown } | null;
    if (!body || body.code !== 0 || !body.data)
      throw new ProviderError(
        `The image-to-3D service returned an error${body?.message ? `: ${String(body.message).slice(0, 300)}` : "."}`,
      );
    return body.data;
  }
  private async upload(image: InputImage) {
    const type = image.mimeType === "image/png" ? "png" : "jpg",
      form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(image.data)], { type: image.mimeType }),
      `${image.view}.${type}`,
    );
    const data = (await this.request("upload", {
      method: "POST",
      body: form,
    })) as { image_token?: unknown };
    if (typeof data.image_token !== "string")
      throw new ProviderError(
        "The image-to-3D service did not accept the photograph.",
      );
    return { type, file_token: data.image_token };
  }
  private async create(body: object) {
    const data = (await this.request("task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        texture: true,
        pbr: true,
        ...(this.options.modelVersion
          ? { model_version: this.options.modelVersion }
          : {}),
      }),
    })) as { task_id?: unknown };
    if (typeof data.task_id !== "string" || !taskId.test(data.task_id))
      throw new ProviderError(
        "The image-to-3D service did not return a job reference.",
      );
    return { id: data.task_id };
  }
  async createFromImage({ image }: { image: InputImage }) {
    return this.create({
      type: "image_to_model",
      file: await this.upload(image),
    });
  }
  async createFromMultiView({ images }: { images: InputImage[] }) {
    if (!images.some((i) => i.view === "front"))
      throw new ProviderError("A front view is required.", 400);
    const files = await Promise.all(
      viewOrder.map((view) => {
        const image = images.find((i) => i.view === view);
        return image ? this.upload(image) : {};
      }),
    );
    return this.create({ type: "multiview_to_model", files });
  }
  private async task(jobId: string) {
    if (!taskId.test(jobId))
      throw new ProviderError("This generation job is not recognized.", 404);
    return (await this.request(`task/${jobId}`)) as TripoTask;
  }
  async getStatus(jobId: string): Promise<GenerationStatus> {
    const task = await this.task(jobId),
      progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
    if (task.status === "success") return { state: "succeeded", progress: 100 };
    if (
      ["failed", "cancelled", "banned", "expired", "unknown"].includes(
        task.status || "",
      )
    )
      return {
        state: "failed",
        progress,
        error:
          task.status === "banned"
            ? "The image was rejected by the service's content policy."
            : task.status === "expired"
              ? "The generation job expired. Please generate again."
              : "The image could not be turned into a 3D model.",
      };
    return { state: task.status === "queued" ? "queued" : "running", progress };
  }
  async getResult(jobId: string) {
    const task = await this.task(jobId),
      modelUrl =
        task.output?.pbr_model || task.output?.model || task.output?.base_model;
    if (task.status !== "success" || !modelUrl)
      throw new ProviderError("The generated model is not available yet.", 409);
    return { modelUrl, format: "glb" as const };
  }
}
