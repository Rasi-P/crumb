import { z } from "zod";
import { defaultCake } from "../../domain/seed";
import { cakeSchema, type CakeConfig } from "../../domain/models";
import { normalizeCake, decorationGroup } from "../../domain/cakeScene";
export const imageAnalysisSchema = z.object({
  method: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  tiers: z
    .array(
      z.object({
        diameter: z.number().min(4).max(16),
        height: z.number().min(2).max(8),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        frosting: z.enum([
          "Buttercream",
          "Fondant",
          "Ganache",
          "Whipped Cream",
        ]),
      }),
    )
    .min(1)
    .max(4),
  decorations: z
    .array(
      z.object({
        assetId: z.string(),
        tierIndex: z.number().int().min(0).max(3),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .max(30),
  topper: z.string().max(50),
  observations: z.array(z.string()).max(20),
});
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;
export type GeneratedAsset = {
  modelUrl: string;
  thumbnail?: string;
  license: string;
};
export interface ImageToCakeService {
  analyzeImage(image: File, signal?: AbortSignal): Promise<ImageAnalysis>;
  generateInitialCakeConfig(analysis: ImageAnalysis): Promise<CakeConfig>;
  generateAsset(
    description: string,
    signal?: AbortSignal,
  ): Promise<GeneratedAsset>;
  generateReferenceMesh(
    image: File,
    signal?: AbortSignal,
  ): Promise<GeneratedAsset>;
}
export async function configurationFromAnalysis(
  raw: ImageAnalysis,
): Promise<CakeConfig> {
  const a = imageAnalysisSchema.parse(raw),
    c = normalizeCake({
      ...defaultCake(),
      tiers: a.tiers.map((t, i) => ({
        ...t,
        id: crypto.randomUUID(),
        finish: "Smooth",
        decorations: [],
      })),
      text: "",
      topper: a.topper,
      sellingPrice: null,
      delivery: 0,
    });
  c.objects = a.decorations.flatMap((d) =>
    c.tiers[d.tierIndex]
      ? decorationGroup(d.assetId, c.tiers[d.tierIndex].id, d.quantity, 100)
      : [],
  );
  return cakeSchema.parse(c);
}
// Offline starting-point estimator, deliberately not advertised as AI reconstruction.
// Replace this adapter through configureImageToCakeService to use a server-side vision provider.
export class LocalImageToCakeService implements ImageToCakeService {
  async analyzeImage(file: File, signal?: AbortSignal): Promise<ImageAnalysis> {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Choose a JPG, PNG, or WebP photograph.");
    if (file.size > 12 * 1024 * 1024)
      throw new Error("Choose an image smaller than 12 MB.");
    signal?.throwIfAborted();
    const bitmap = await createImageBitmap(file, {
      resizeWidth: 192,
      resizeHeight: 192,
      resizeQuality: "high",
    });
    signal?.throwIfAborted();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, 192, 192);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, 192, 192),
      background = [0, 0, 0];
    let count = 0;
    for (let y = 0; y < 192; y += 4)
      for (const x of [2, 189]) {
        for (let k = 0; k < 3; k++)
          background[k] += data[(y * 192 + x) * 4 + k];
        count++;
      }
    background.forEach((_, i) => (background[i] /= count));
    const widths: number[] = [],
      buckets = new Map<string, { sum: number[]; n: number }>();
    for (let y = 20; y < 175; y++) {
      let left = 192,
        right = 0;
      for (let x = 25; x < 167; x++) {
        const n = (y * 192 + x) * 4,
          c = [data[n], data[n + 1], data[n + 2]],
          delta = Math.hypot(...c.map((v, k) => v - background[k]));
        if (delta > 38) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
        if (
          x > 50 &&
          x < 142 &&
          y > 55 &&
          y < 155 &&
          delta > 25 &&
          Math.max(...c) > 90
        ) {
          const key = c.map((v) => Math.round(v / 24)).join(":");
          const b = buckets.get(key) || { sum: [0, 0, 0], n: 0 };
          c.forEach((v, k) => (b.sum[k] += v));
          b.n++;
          buckets.set(key, b);
        }
      }
      widths.push(Math.max(0, right - left));
    }
    const bands = Array.from({ length: 5 }, (_, i) => {
      const v = widths.slice(30 + i * 20, 50 + i * 20).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)] || 0;
    });
    const transitions = bands
      .slice(1)
      .filter((w, i) => w > bands[i] * 1.18 && w - bands[i] > 12).length;
    const tierCount = Math.min(3, Math.max(1, transitions + 1));
    const dominant = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
    const color = dominant
      ? "#" +
        dominant.sum
          .map((v) =>
            Math.round(v / dominant.n)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
      : "#f1d6d8";
    return imageAnalysisSchema.parse({
      method: "Local color & silhouette estimate",
      confidence: "low",
      tiers: Array.from({ length: tierCount }, (_, i) => ({
        diameter: Math.max(4, 10 - i * 2),
        height: 4,
        color,
        frosting: "Buttercream",
      })),
      decorations: [],
      topper: "",
      observations: [
        "Color is sampled from the central image; backgrounds and flowers can affect the result.",
        "Tier count is estimated from silhouette width changes. Confirm the count and dimensions below.",
        "Absolute size, frosting recipe, hidden surfaces, flowers, and topper wording cannot be reliably identified by this local estimator.",
      ],
    });
  }
  generateInitialCakeConfig(a: ImageAnalysis) {
    return configurationFromAnalysis(a);
  }
  async generateAsset(): Promise<GeneratedAsset> {
    throw new Error(
      "Asset generation requires a connected image-to-3D provider. The built-in decoration library is available offline.",
    );
  }
  async generateReferenceMesh(): Promise<GeneratedAsset> {
    throw new Error(
      "Reference mesh generation requires a connected provider. A single photograph cannot reconstruct hidden geometry.",
    );
  }
}
let service: ImageToCakeService = new LocalImageToCakeService();
export const getImageToCakeService = () => service;
export const configureImageToCakeService = (adapter: ImageToCakeService) => {
  service = adapter;
};
