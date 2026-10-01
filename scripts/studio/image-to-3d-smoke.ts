// Runs one photograph through the configured image-to-3D provider and saves
// the GLB it returns. Use it to confirm an API key and account work before
// relying on the studio dialog. This spends provider credits.
//
//   node --env-file=.env --import tsx scripts/studio/image-to-3d-smoke.ts cake.jpg [out.glb]
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import { createImageTo3DProvider } from "../../server/imageTo3d";
import { downloadModel, validateGlb } from "../../server/imageTo3d/glb";

const [input, output = "generated-cake.glb"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: image-to-3d-smoke.ts <photo.jpg|png> [out.glb]");
  process.exit(1);
}
const provider = createImageTo3DProvider(process.env);
if (!provider) {
  console.error(
    "Image-to-3D service not configured. Set MESHY_API_KEY or TRIPO_API_KEY.",
  );
  process.exit(1);
}
const job = await provider.createFromImage({
  image: {
    view: "front",
    mimeType:
      extname(input).toLowerCase() === ".png" ? "image/png" : "image/jpeg",
    data: readFileSync(input),
  },
});
console.log("Job created. Waiting for the model…");
for (;;) {
  const status = await provider.getStatus(job.id);
  if (status.state === "failed") {
    console.error(`Generation failed: ${status.error}`);
    process.exit(1);
  }
  if (status.state === "succeeded") break;
  console.log(`  ${status.state} ${status.progress}%`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
const result = await provider.getResult(job.id),
  model = await downloadModel(fetch, result.modelUrl, {
    maxBytes: 200 * 1024 * 1024,
    allowInsecure: false,
  });
const { meshes } = validateGlb(model);
writeFileSync(output, model);
console.log(
  `Saved ${output} (${(model.length / 1048576).toFixed(1)} MB, ${meshes} mesh${meshes === 1 ? "" : "es"}). Import it in the studio or open it in any glTF viewer.`,
);
