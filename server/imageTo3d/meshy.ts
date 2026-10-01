import {
  ProviderError,
  providerRequest,
  type Fetch,
  type GenerationStatus,
  type ImageTo3DProvider,
  type InputImage,
} from "./types";

type MeshyTask = {
  status?: string;
  progress?: number;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
};

const taskId = /^[A-Za-z0-9-]{8,64}$/;
const dataUri = (image: InputImage) =>
  `data:${image.mimeType};base64,${image.data.toString("base64")}`;

// https://docs.meshy.ai/en/api/image-to-3d and /multi-image-to-3d
export class MeshyProvider implements ImageTo3DProvider {
  readonly maxViews = 4;
  constructor(
    private readonly apiKey: string,
    private readonly options: {
      baseUrl?: string;
      aiModel?: string;
      targetPolycount?: number;
      fetch?: Fetch;
    } = {},
  ) {}
  private request(path: string, body?: unknown) {
    return providerRequest(
      this.options.fetch ?? fetch,
      `${this.options.baseUrl ?? "https://api.meshy.ai"}/openapi/v1/${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
  }
  private settings() {
    return {
      ai_model: this.options.aiModel ?? "latest",
      should_texture: true,
      enable_pbr: true,
      target_formats: ["glb"],
      ...(this.options.targetPolycount
        ? {
            should_remesh: true,
            target_polycount: this.options.targetPolycount,
          }
        : {}),
    };
  }
  private async create(kind: "image" | "multi", body: object) {
    const result = (await this.request(
      kind === "image" ? "image-to-3d" : "multi-image-to-3d",
      { ...body, ...this.settings() },
    )) as { result?: unknown } | null;
    if (typeof result?.result !== "string" || !taskId.test(result.result))
      throw new ProviderError(
        "The image-to-3D service did not return a job reference.",
      );
    return { id: `${kind}:${result.result}` };
  }
  createFromImage({ image }: { image: InputImage }) {
    return this.create("image", { image_url: dataUri(image) });
  }
  createFromMultiView({ images }: { images: InputImage[] }) {
    return this.create("multi", { image_urls: images.map(dataUri) });
  }
  private async task(jobId: string) {
    const [kind, id] = jobId.split(":");
    if ((kind !== "image" && kind !== "multi") || !taskId.test(id || ""))
      throw new ProviderError("This generation job is not recognized.", 404);
    return (await this.request(
      `${kind === "image" ? "image-to-3d" : "multi-image-to-3d"}/${id}`,
    )) as MeshyTask;
  }
  async getStatus(jobId: string): Promise<GenerationStatus> {
    const task = await this.task(jobId),
      progress = Math.max(0, Math.min(100, Number(task.progress) || 0));
    if (task.status === "SUCCEEDED")
      return { state: "succeeded", progress: 100 };
    if (task.status === "FAILED" || task.status === "CANCELED")
      return {
        state: "failed",
        progress,
        error:
          task.task_error?.message?.slice(0, 300) ||
          (task.status === "CANCELED"
            ? "The generation was cancelled."
            : "The image could not be turned into a 3D model."),
      };
    return {
      state: task.status === "IN_PROGRESS" ? "running" : "queued",
      progress,
    };
  }
  async getResult(jobId: string) {
    const task = await this.task(jobId);
    if (task.status !== "SUCCEEDED" || !task.model_urls?.glb)
      throw new ProviderError("The generated model is not available yet.", 409);
    return { modelUrl: task.model_urls.glb, format: "glb" as const };
  }
}
