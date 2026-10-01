import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { createImageTo3DProvider } from "../server/imageTo3d";
import { validateGlb } from "../server/imageTo3d/glb";
import { MeshyProvider } from "../server/imageTo3d/meshy";
import { TripoProvider } from "../server/imageTo3d/tripo";
import type { InputImage } from "../server/imageTo3d/types";
import type { AssetStore, StoredAsset } from "../server/storage/assets";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]),
  image = (view: InputImage["view"]): InputImage => ({
    view,
    mimeType: "image/jpeg",
    data: jpeg,
  }),
  taskId = "018a210d-8ba4-705c-b111-1f1776f7f578";

// The smallest structurally valid GLB: a JSON chunk naming one mesh.
function glb(json: object = { asset: { version: "2.0" }, meshes: [{}] }) {
  const text = Buffer.from(JSON.stringify(json)),
    chunk = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(chunk);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, chunk]);
}
type Call = { url: string; init: RequestInit };
function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init: RequestInit = {},
  ) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Meshy adapter", () => {
  it("sends one photograph as a data URI with PBR GLB output and the API key", async () => {
    const { calls, fetchImpl } = fakeFetch(() => json({ result: taskId }));
    const job = await new MeshyProvider("secret", {
      fetch: fetchImpl,
    }).createFromImage({ image: image("front") });
    expect(job.id).toBe(`image:${taskId}`);
    expect(calls[0].url).toBe("https://api.meshy.ai/openapi/v1/image-to-3d");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      ai_model: "latest",
      should_texture: true,
      enable_pbr: true,
      target_formats: ["glb"],
    });
  });
  it("sends every view to the multi-image endpoint and polls that endpoint", async () => {
    const { calls, fetchImpl } = fakeFetch(({ init }) =>
      init.method === "POST"
        ? json({ result: taskId })
        : json({ status: "IN_PROGRESS", progress: 42 }),
    );
    const provider = new MeshyProvider("secret", { fetch: fetchImpl }),
      job = await provider.createFromMultiView({
        images: [image("front"), image("left"), image("back")],
      });
    expect(calls[0].url).toMatch(/\/openapi\/v1\/multi-image-to-3d$/);
    expect(JSON.parse(calls[0].init.body as string).image_urls).toHaveLength(3);
    expect(await provider.getStatus(job.id)).toEqual({
      state: "running",
      progress: 42,
    });
    expect(calls[1].url).toMatch(
      new RegExp(`/openapi/v1/multi-image-to-3d/${taskId}$`),
    );
  });
  it("maps task states, failure reasons, and the GLB result", async () => {
    let task: object = { status: "PENDING", progress: 0 };
    const { fetchImpl } = fakeFetch(() => json(task)),
      provider = new MeshyProvider("secret", { fetch: fetchImpl }),
      id = `image:${taskId}`;
    expect((await provider.getStatus(id)).state).toBe("queued");
    await expect(provider.getResult(id)).rejects.toThrow(/not available yet/);
    task = { status: "FAILED", task_error: { message: "No object found" } };
    expect(await provider.getStatus(id)).toMatchObject({
      state: "failed",
      error: "No object found",
    });
    task = {
      status: "SUCCEEDED",
      progress: 100,
      model_urls: { glb: "https://assets.meshy.ai/x/model.glb" },
    };
    expect(await provider.getStatus(id)).toEqual({
      state: "succeeded",
      progress: 100,
    });
    expect(await provider.getResult(id)).toEqual({
      modelUrl: "https://assets.meshy.ai/x/model.glb",
      format: "glb",
    });
  });
  it("reports provider rejections without leaking them as successes", async () => {
    const provider = (status: number) =>
      new MeshyProvider("secret", {
        fetch: fakeFetch(() => json({ message: "nope" }, status)).fetchImpl,
      });
    await expect(
      provider(401).createFromImage({ image: image("front") }),
    ).rejects.toThrow(/API key/);
    await expect(
      provider(402).createFromImage({ image: image("front") }),
    ).rejects.toThrow(/credits/);
    await expect(provider(429).getStatus(`image:${taskId}`)).rejects.toThrow(
      /busy/,
    );
    // Job references are never interpolated into a URL unchecked.
    await expect(
      provider(200).getStatus("image:../../account"),
    ).rejects.toThrow(/not recognized/);
  });
});

describe("Tripo adapter", () => {
  it("uploads the photograph, then creates a textured PBR image_to_model task", async () => {
    const { calls, fetchImpl } = fakeFetch(({ url }) =>
      url.endsWith("/upload")
        ? json({ code: 0, data: { image_token: "token-front" } })
        : json({ code: 0, data: { task_id: taskId } }),
    );
    const job = await new TripoProvider("secret", {
      fetch: fetchImpl,
    }).createFromImage({ image: image("front") });
    expect(job.id).toBe(taskId);
    expect(calls[0].url).toBe("https://api.tripo3d.ai/v2/openapi/upload");
    expect(calls[0].init.body).toBeInstanceOf(FormData);
    expect(calls[1].url).toBe("https://api.tripo3d.ai/v2/openapi/task");
    expect(JSON.parse(calls[1].init.body as string)).toEqual({
      type: "image_to_model",
      file: { type: "jpg", file_token: "token-front" },
      texture: true,
      pbr: true,
    });
  });
  it("orders multiview files front, left, back, right and leaves gaps empty", async () => {
    const { calls, fetchImpl } = fakeFetch(({ url, init }) =>
      url.endsWith("/upload")
        ? json({
            code: 0,
            data: {
              image_token: `token-${((init.body as FormData).get("file") as File).name}`,
            },
          })
        : json({ code: 0, data: { task_id: taskId } }),
    );
    const provider = new TripoProvider("secret", { fetch: fetchImpl });
    await provider.createFromMultiView({
      images: [image("right"), image("front")],
    });
    expect(JSON.parse(calls.at(-1)!.init.body as string)).toMatchObject({
      type: "multiview_to_model",
      files: [
        { type: "jpg", file_token: "token-front.jpg" },
        {},
        {},
        { type: "jpg", file_token: "token-right.jpg" },
      ],
    });
    await expect(
      provider.createFromMultiView({ images: [image("left")] }),
    ).rejects.toThrow(/front view/);
  });
  it("maps task states and prefers the PBR model", async () => {
    let data: object = { status: "running", progress: 30 };
    const { fetchImpl } = fakeFetch(() => json({ code: 0, data })),
      provider = new TripoProvider("secret", { fetch: fetchImpl });
    expect(await provider.getStatus(taskId)).toEqual({
      state: "running",
      progress: 30,
    });
    data = { status: "banned" };
    expect((await provider.getStatus(taskId)).state).toBe("failed");
    data = {
      status: "success",
      output: { model: "https://t/m.glb", pbr_model: "https://t/pbr.glb" },
    };
    expect(await provider.getResult(taskId)).toEqual({
      modelUrl: "https://t/pbr.glb",
      format: "glb",
    });
  });
});

describe("provider selection", () => {
  it("returns nothing when no key is configured, and honours an explicit choice", () => {
    expect(createImageTo3DProvider({})).toBeNull();
    expect(createImageTo3DProvider({ MESHY_API_KEY: "a" })).toBeInstanceOf(
      MeshyProvider,
    );
    expect(
      createImageTo3DProvider({ MESHY_API_KEY: "a", TRIPO_API_KEY: "b" }),
    ).toBeInstanceOf(MeshyProvider);
    expect(
      createImageTo3DProvider({
        IMAGE_TO_3D_PROVIDER: "tripo",
        MESHY_API_KEY: "a",
        TRIPO_API_KEY: "b",
      }),
    ).toBeInstanceOf(TripoProvider);
    expect(
      createImageTo3DProvider({
        IMAGE_TO_3D_PROVIDER: "tripo",
        MESHY_API_KEY: "a",
      }),
    ).toBeNull();
  });
});

describe("GLB validation", () => {
  it("accepts a well-formed binary glTF and rejects everything else", () => {
    expect(validateGlb(glb())).toEqual({ meshes: 1 });
    expect(() => validateGlb(Buffer.from("<html>not a model</html>"))).toThrow(
      /not a binary glTF/,
    );
    expect(() => validateGlb(glb().subarray(0, 30))).toThrow(/incomplete/);
    expect(() => validateGlb(glb({ asset: { version: "2.0" } }))).toThrow(
      /geometry/,
    );
    expect(() =>
      validateGlb(
        glb({
          asset: { version: "2.0" },
          meshes: [{}],
          extensionsRequired: ["VENDOR_private_codec"],
        }),
      ),
    ).toThrow(/unsupported/);
  });
});

describe("studio image-to-3D routes", () => {
  let server: Server | undefined;
  afterEach(() => server?.close());
  const memoryStore = () => {
    const items = new Map<string, StoredAsset>();
    const store: AssetStore = {
      put: async (id, asset) => void items.set(id, asset),
      get: async (id) => items.get(id) ?? null,
    };
    return { items, store };
  };
  async function start(
    environment: NodeJS.ProcessEnv,
    fetchImpl: typeof fetch,
    store: AssetStore,
  ) {
    server = createServer(
      createApp(undefined, environment, {
        fetch: fetchImpl,
        assets: async () => store,
      }),
    );
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", resolve),
    );
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/studio`;
  }
  const front = {
    view: "front",
    data: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
  };
  const post = (base: string, body: unknown) =>
    fetch(`${base}/image-to-3d/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  it("says the service is not configured instead of producing a model", async () => {
    const { calls, fetchImpl } = fakeFetch(() => json({})),
      { items, store } = memoryStore(),
      base = await start({}, fetchImpl, store);
    expect(await (await fetch(`${base}/image-to-3d`)).json()).toEqual({
      configured: false,
      maxViews: 0,
    });
    const response = await post(base, { images: [front] });
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe(
      "Image-to-3D service not configured",
    );
    expect(calls).toHaveLength(0);
    expect(items.size).toBe(0);
  });
  it("runs a photograph through the provider and stores the returned GLB once", async () => {
    const model = glb();
    let polls = 0,
      downloads = 0;
    const { calls, fetchImpl } = fakeFetch(({ url, init }) => {
      if (init.method === "POST") return json({ result: taskId });
      if (url === "https://assets.example/model.glb") {
        downloads++;
        return new Response(new Uint8Array(model));
      }
      return json(
        ++polls < 2
          ? { status: "IN_PROGRESS", progress: 55 }
          : {
              status: "SUCCEEDED",
              progress: 100,
              model_urls: { glb: "https://assets.example/model.glb" },
            },
      );
    });
    const { items, store } = memoryStore(),
      base = await start({ MESHY_API_KEY: "secret" }, fetchImpl, store);
    expect(await (await fetch(`${base}/image-to-3d`)).json()).toEqual({
      configured: true,
      maxViews: 4,
    });
    const created = await post(base, { images: [front] });
    expect(created.status).toBe(202);
    const { jobId, referenceImages } = await created.json();
    expect(calls[0].url).toMatch(/\/image-to-3d$/);
    // The photograph is kept as the design's reference image.
    expect(referenceImages).toHaveLength(1);
    const reference = await fetch(new URL(referenceImages[0].url, base));
    expect(reference.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await reference.arrayBuffer())).toEqual(jpeg);

    const status = () =>
      fetch(`${base}/image-to-3d/jobs/${jobId}`).then((r) => r.json());
    expect(await status()).toEqual({ state: "running", progress: 55 });
    const done = await status();
    expect(done.state).toBe("succeeded");
    expect(done.model.url).toMatch(/^\/api\/studio\/assets\/[a-f0-9]{32}$/);
    // Polling again returns the same stored model without another download.
    expect((await status()).model.url).toBe(done.model.url);
    expect(downloads).toBe(1);
    const stored = await fetch(new URL(done.model.url, base));
    expect(stored.headers.get("content-type")).toBe("model/gltf-binary");
    expect(stored.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await stored.arrayBuffer())).toEqual(model);
    expect(items.size).toBe(2);
  });
  it("refuses a provider result that is not a real model", async () => {
    const { fetchImpl } = fakeFetch(({ url, init }) =>
        init.method === "POST"
          ? json({ result: taskId })
          : url.endsWith(".glb")
            ? new Response("<html>expired link</html>")
            : json({
                status: "SUCCEEDED",
                model_urls: { glb: "https://assets.example/model.glb" },
              }),
      ),
      { items, store } = memoryStore(),
      base = await start({ MESHY_API_KEY: "secret" }, fetchImpl, store),
      { jobId } = await (await post(base, { images: [front] })).json(),
      response = await fetch(`${base}/image-to-3d/jobs/${jobId}`);
    expect(response.status).toBe(422);
    expect([...items.values()].map((a) => a.contentType)).toEqual([
      "image/jpeg",
    ]);
  });
  it("validates uploads: image type, duplicate views, a missing front, and GLB imports", async () => {
    const { fetchImpl } = fakeFetch(() => json({ result: taskId })),
      { store } = memoryStore(),
      base = await start({ MESHY_API_KEY: "secret" }, fetchImpl, store);
    expect(
      (
        await post(base, {
          images: [{ view: "front", data: "data:image/gif;base64,R0lGOD" }],
        })
      ).status,
    ).toBe(400);
    expect((await post(base, { images: [front, front] })).status).toBe(400);
    expect(
      (await post(base, { images: [{ ...front, view: "left" }] })).status,
    ).toBe(400);
    const upload = (body: Buffer) =>
      fetch(`${base}/assets`, {
        method: "POST",
        headers: { "Content-Type": "model/gltf-binary" },
        body: new Uint8Array(body),
      });
    expect((await upload(Buffer.from("not a model"))).status).toBe(422);
    const imported = await upload(glb());
    expect(imported.status).toBe(201);
    const { url } = await imported.json();
    expect((await fetch(new URL(url, base))).status).toBe(200);
    expect(
      (await fetch(`${base}/assets/00000000000000000000000000000000`)).status,
    ).toBe(404);
  });
});
