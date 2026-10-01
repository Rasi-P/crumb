import express from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { referenceViews } from "../src/domain/models";
import { createImageTo3DProvider } from "./imageTo3d";
import { downloadModel, validateGlb } from "./imageTo3d/glb";
import { ProviderError, type Fetch, type InputImage } from "./imageTo3d/types";
import { assetId, getAssetStore, type AssetStore } from "./storage/assets";

const jobsRequest = z.object({
  images: z
    .array(
      z.object({
        view: z.enum(referenceViews),
        data: z.string().max(12_000_000),
      }),
    )
    .min(1)
    .max(4),
});
const assetUrl = (id: string) => `/api/studio/assets/${id}`;

function decodeImage(view: InputImage["view"], data: string): InputImage {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+=*)$/.exec(
    data,
  );
  if (!match)
    throw new ProviderError("Photographs must be JPEG or PNG images.", 400);
  const bytes = Buffer.from(match[2], "base64"),
    mimeType = match[1] as InputImage["mimeType"],
    signature = mimeType === "image/png" ? "89504e47" : "ffd8ff";
  if (
    bytes.length > 8 * 1024 * 1024 ||
    !bytes.toString("hex", 0, 4).startsWith(signature)
  )
    throw new ProviderError("Photographs must be JPEG or PNG images.", 400);
  return { view, mimeType, data: bytes };
}

export function createStudioRoutes(
  environment: NodeJS.ProcessEnv,
  options: { assets?: () => Promise<AssetStore>; fetch?: Fetch } = {},
) {
  const assets = options.assets ?? getAssetStore,
    fetchImpl = options.fetch ?? fetch,
    provider = createImageTo3DProvider(environment, fetchImpl),
    maxModelBytes =
      (Number(environment.STUDIO_MAX_MODEL_MB) || 96) * 1024 * 1024;
  const requireProvider = () => {
    if (!provider)
      throw new ProviderError("Image-to-3D service not configured", 503);
    return provider;
  };

  // Asset links are unguessable and immutable; customers viewing a quotation
  // need them without a workspace session.
  const publicRoutes = express.Router();
  publicRoutes.get("/assets/:id", async (req, res) => {
    const asset = assetId.test(req.params.id)
      ? await (await assets()).get(req.params.id)
      : null;
    if (!asset) {
      res.status(404).json({ error: "This studio asset does not exist." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Type", asset.contentType);
    res.send(asset.data);
  });

  const routes = express.Router();
  routes.get("/image-to-3d", (_req, res) => {
    res.json({ configured: !!provider, maxViews: provider?.maxViews ?? 0 });
  });
  routes.post(
    "/image-to-3d/jobs",
    express.json({ limit: "24mb" }),
    async (req, res) => {
      const active = requireProvider(),
        body = jobsRequest.parse(req.body),
        images = body.images.map((i) => decodeImage(i.view, i.data));
      if (
        new Set(images.map((i) => i.view)).size !== images.length ||
        !images.some((i) => i.view === "front")
      )
        throw new ProviderError(
          "Provide one photograph per view, including the front.",
          400,
        );
      if (images.length > active.maxViews)
        throw new ProviderError("Too many photographs for this service.", 400);
      const job =
        images.length === 1
          ? await active.createFromImage({ image: images[0] })
          : await active.createFromMultiView({ images });
      const store = await assets(),
        referenceImages = await Promise.all(
          images.map(async (image) => {
            const id = randomBytes(16).toString("hex");
            await store.put(id, {
              contentType: image.mimeType,
              data: image.data,
            });
            return { id, url: assetUrl(id), view: image.view };
          }),
        );
      res.status(202).json({
        jobId: Buffer.from(job.id).toString("base64url"),
        referenceImages,
      });
    },
  );
  routes.get("/image-to-3d/jobs/:jobId", async (req, res) => {
    const active = requireProvider(),
      jobId = Buffer.from(req.params.jobId, "base64url").toString("utf8"),
      status = await active.getStatus(jobId);
    if (status.state !== "succeeded") {
      res.json(status);
      return;
    }
    // The same job always maps to the same asset, so repeated polls and
    // reloads never download or store the model twice.
    const id = createHash("sha256")
        .update(`generated-model:${jobId}`)
        .digest("hex")
        .slice(0, 32),
      store = await assets();
    if (!(await store.get(id))) {
      const result = await active.getResult(jobId),
        data = await downloadModel(fetchImpl, result.modelUrl, {
          maxBytes: maxModelBytes,
          allowInsecure: environment.NODE_ENV !== "production",
        });
      validateGlb(data);
      await store.put(id, { contentType: "model/gltf-binary", data });
    }
    res.json({ ...status, model: { url: assetUrl(id) } });
  });
  // Import of a GLB the baker already has. The body is the file itself.
  routes.post(
    "/assets",
    express.raw({ type: "model/gltf-binary", limit: maxModelBytes }),
    async (req, res) => {
      if (!Buffer.isBuffer(req.body))
        throw new ProviderError("Upload a .glb model file.", 415);
      validateGlb(req.body);
      const id = randomBytes(16).toString("hex");
      await (
        await assets()
      ).put(id, {
        contentType: "model/gltf-binary",
        data: req.body,
      });
      res.status(201).json({ url: assetUrl(id) });
    },
  );
  return { publicRoutes, routes };
}
