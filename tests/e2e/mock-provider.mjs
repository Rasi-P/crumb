import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { buildCakeGlb } from "./cake-glb.mjs";

// Stands in for the Meshy HTTP API during browser tests, so the real adapter,
// download, validation and storage path run without spending credits. It is
// never part of the application: the server reaches it only through
// MESHY_API_BASE_URL in the Playwright configuration.
const port = Number(process.env.PORT || 5181),
  model = buildCakeGlb(),
  polls = new Map(),
  stats = { created: 0, multiView: 0, downloads: 0 };
if (process.argv[2]) writeFileSync(process.argv[2], model);
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === "/stats") return send(res, 200, stats);
  if (url.pathname === "/files/model.glb") {
    stats.downloads++;
    res.writeHead(200, {
      "Content-Type": "model/gltf-binary",
      "Content-Length": model.length,
    });
    res.end(model);
    return;
  }
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (req.headers.authorization !== "Bearer e2e-key")
    return send(res, 401, { message: "Invalid API key" });
  const match =
    /^\/openapi\/v1\/(image-to-3d|multi-image-to-3d)(?:\/([\w-]+))?$/.exec(
      url.pathname,
    );
  if (!match) return send(res, 404, { message: "Not found" });
  if (req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body),
      images =
        match[1] === "image-to-3d" ? [input.image_url] : input.image_urls;
    if (
      !Array.isArray(images) ||
      !images.length ||
      images.some((i) => !/^data:image\/(jpeg|png);base64,/.test(i || "")) ||
      input.enable_pbr !== true
    )
      return send(res, 400, { message: "Invalid image input" });
    const id = randomUUID();
    stats.created++;
    if (images.length > 1) stats.multiView++;
    polls.set(id, 0);
    return send(res, 202, { result: id });
  }
  if (!polls.has(match[2]))
    return send(res, 404, { message: "Task not found" });
  const count = polls.get(match[2]) + 1;
  polls.set(match[2], count);
  return send(
    res,
    200,
    count < 2
      ? { id: match[2], status: "IN_PROGRESS", progress: 45 }
      : {
          id: match[2],
          status: "SUCCEEDED",
          progress: 100,
          model_urls: { glb: `http://127.0.0.1:${port}/files/model.glb` },
        },
  );
}).listen(port, "127.0.0.1", () =>
  console.log(`Mock image-to-3D provider on ${port}`),
);
