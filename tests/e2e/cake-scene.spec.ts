import { readFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { buildCakeGlb } from "./cake-glb.mjs";

// The saved document, read back through the studio's own JSON export.
async function exported(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export cake JSON" }).click();
  return JSON.parse(await readFile(await (await download).path(), "utf8"));
}
// A real pointer drag across the canvas, in fractions of its size.
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const rect = (await page.locator("canvas").boundingBox())!,
    at = ([x, y]: [number, number]) =>
      [rect.x + rect.width * x, rect.y + rect.height * y] as const;
  await page.mouse.move(...at(from));
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(
      ...at([
        from[0] + ((to[0] - from[0]) * i) / 12,
        from[1] + ((to[1] - from[1]) * i) / 12,
      ]),
    );
  await page.mouse.up();
}
async function generateFromPhoto(page: Page) {
  await page.getByRole("button", { name: /Create from Cake Image/ }).click();
  await page
    .getByLabel("Front view photograph")
    .setInputFiles("public/images/cake-collection.png");
  await page
    .getByRole("button", { name: "Generate 3D model", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(/3D/);
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByLabel("Model name", { exact: true })).toHaveValue(
    "Generated cake",
  );
  // Let the stored GLB load and the camera settle on it.
  await page.waitForTimeout(2500);
}

test("individual scene objects survive 2D editing, undo, duplication, locking, and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("tab", { name: "Elements", exact: true }).click();
  await page.getByRole("button", { name: "Garden rose", exact: true }).click();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Garden rose",
  );
  await page.getByLabel("Object name", { exact: true }).fill("Hero rose");
  await page.getByLabel("Scale", { exact: true }).fill("1.4");
  await page.getByLabel("Angle (°)", { exact: true }).fill("90");
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hero rose", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("tab", { name: "2D Design", exact: true }).click();
  await expect(
    page
      .locator(".design-2d-stage")
      .getByRole("button", { name: "Select Hero rose", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Duplicate object", exact: true })
    .click();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Hero rose copy",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Hero rose copy", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Hero rose", exact: true }).click();
  await page.getByRole("button", { name: "Lock object", exact: true }).click();
  await expect(page.getByLabel("Scale", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock object", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Design saved", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Hero rose", exact: true }).click();
  await expect(page.getByLabel("Scale", { exact: true })).toHaveValue("1.4");
  await expect(page.getByLabel("Angle (°)", { exact: true })).toHaveValue("90");
  await page.getByRole("button", { name: "Hide object", exact: true }).click();
  await page.getByRole("tab", { name: "2D Design", exact: true }).click();
  await expect(
    page
      .locator(".design-2d-stage")
      .getByRole("button", { name: "Select Hero rose", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("one-tier vertical slice updates actual preview, material, dimensions and pricing", async ({
  page,
}) => {
  await page.goto("/studio");
  await page
    .getByRole("button", { name: "A fresh little canvas", exact: false })
    .click();
  await expect(page.getByLabel("Tier diameter")).toHaveValue("8");
  await page.getByLabel("Tier diameter").fill("10");
  await page.getByLabel("Tier height").fill("5");
  await page.getByLabel("Custom frosting color").fill("#d993aa");
  await page.getByLabel("Frosting", { exact: true }).selectOption("Ganache");
  await page.getByLabel("Finish", { exact: true }).selectOption("Textured");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Design saved", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".artifacts/studio-single-tier.png" });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export cake JSON" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain(".cake.json");
  await page.getByRole("tab", { name: "2D Design", exact: true }).click();
  await expect(page.locator(".design-2d-stage svg")).toHaveAttribute(
    "aria-label",
    /1-tier/,
  );
  await page.reload();
  await expect(page.getByLabel("Tier diameter")).toHaveValue("10");
  await expect(page.getByLabel("Tier height")).toHaveValue("5");
  await expect(page.getByLabel("Custom frosting color")).toHaveValue("#d993aa");
  await expect(page.getByLabel("Frosting", { exact: true })).toHaveValue(
    "Ganache",
  );
});

test("a decoration is dragged directly across the tier surface, then duplicated, deleted and deselected", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/studio");
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForTimeout(1000);
  const canvas = page.locator("canvas"),
    rect = (await canvas.boundingBox())!;
  const data = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.setData("application/x-cake-asset", "rose-blush");
    return data;
  });
  await canvas.dispatchEvent("drop", {
    dataTransfer: data,
    clientX: rect.x + rect.width * 0.5,
    clientY: rect.y + rect.height * 0.65,
  });
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Garden rose",
  );
  await page.getByLabel("Object name", { exact: true }).fill("Dragged rose");
  await expect(page.getByLabel("Placement", { exact: true })).toHaveValue(
    "side",
  );
  const angle = await page
    .getByLabel("Angle (°)", { exact: true })
    .inputValue();
  // No tool change and no coordinates: press on the flower and drag.
  await drag(page, [0.5, 0.65], [0.6, 0.68]);
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Dragged rose",
  );
  await expect(page.getByLabel("Angle (°)", { exact: true })).not.toHaveValue(
    angle,
  );
  await expect(page.getByLabel("Placement", { exact: true })).toHaveValue(
    "side",
  );
  // The whole drag is one undo step.
  const moved = await page
    .getByLabel("Angle (°)", { exact: true })
    .inputValue();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByLabel("Angle (°)", { exact: true })).toHaveValue(
    angle,
  );
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.getByLabel("Angle (°)", { exact: true })).toHaveValue(
    moved,
  );

  await page.keyboard.press("ControlOrMeta+d");
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Dragged rose copy",
  );
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dragged rose", exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press("Backspace");
  await expect(
    page.getByRole("button", { name: "Dragged rose copy", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Dragged rose", exact: true }),
  ).toHaveCount(1);
  // Shift-click builds a multi-selection; empty space clears it.
  await page.getByRole("button", { name: "Dragged rose", exact: true }).click();
  await page
    .getByRole("button", { name: "Garden rose", exact: true })
    .first()
    .click({ modifiers: ["Shift"] });
  await expect(page.getByText("2 SELECTED", { exact: true })).toBeVisible();
  await canvas.click({ position: { x: 40, y: rect.height * 0.5 } });
  await expect(
    page.getByText("NOTHING SELECTED", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a photograph becomes a provider-generated GLB whose surface carries an editable flower through save and reload", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const before = await (
    await request.get("http://127.0.0.1:5181/stats")
  ).json();
  await page.goto("/studio");
  await page.locator("canvas").waitFor();
  await generateFromPhoto(page);
  // It opens as a new design; the one that was open is not overwritten.
  await expect(page.getByLabel("Design name")).toHaveValue(
    "Cake from photograph",
  );
  const after = await (await request.get("http://127.0.0.1:5181/stats")).json();
  // The model came from the provider API and was downloaded exactly once.
  expect(after.created - before.created).toBe(1);
  expect(after.downloads - before.downloads).toBe(1);

  // The generated mesh is the cake: its separable shells are listed, and the
  // parametric tiers are hidden stand-ins rather than a rebuilt cylinder.
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  for (const name of ["Generated cake", "Cake body", "Decoration 1"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  let cake = await exported(page);
  expect(cake.generatedModels).toHaveLength(1);
  expect(cake.generatedModels[0].url).toMatch(
    /^\/api\/studio\/assets\/[a-f0-9]{32}$/,
  );
  expect(cake.generatedModels[0].parts).toHaveLength(4);
  expect(cake.referenceImages).toHaveLength(1);
  expect(cake.tiers.every((t: { hidden: boolean }) => t.hidden)).toBe(true);
  expect(cake.tiers.map((t: { diameter: number }) => t.diameter)).toEqual([
    6, 4,
  ]);
  const stored = await request.get(cake.generatedModels[0].url);
  expect(stored.headers()["content-type"]).toBe("model/gltf-binary");
  expect((await stored.body()).equals(buildCakeGlb())).toBe(true);

  // Clicking a shell of the generated mesh selects that part, not the cake.
  const canvas = page.locator("canvas"),
    rect = (await canvas.boundingBox())!;
  await canvas.click({
    position: { x: rect.width * 0.665, y: rect.height * 0.613 },
  });
  await expect(page.locator(".selected-object strong")).toHaveText(
    "Decoration 1",
  );

  // Add one editable flower; it lands on the mesh surface in view.
  await page.getByRole("tab", { name: "Elements", exact: true }).click();
  await page.getByRole("button", { name: "Garden rose", exact: true }).click();
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Garden rose",
  );
  await expect(page.getByText(/Attached to Generated cake/)).toBeVisible();
  const rose = async () => (await exported(page)).objects[0];
  const placed = await rose();
  expect(placed.attachment.surface).toBe("model");

  // Drag it onto the side of the bottom tier: it must sit on the cylinder
  // (radius 1.15 of a 3.0 footprint) and face outward.
  await drag(page, [0.5, 0.5], [0.52, 0.64]);
  const side = await rose();
  expect(side.attachment.point).not.toEqual(placed.attachment.point);
  expect(
    Math.hypot(side.attachment.point[0], side.attachment.point[2]),
  ).toBeCloseTo(1.15 / 3, 2);
  expect(Math.abs(side.attachment.normal[1])).toBeLessThan(0.2);
  expect(
    side.attachment.normal[0] * side.attachment.point[0] +
      side.attachment.normal[2] * side.attachment.point[2],
  ).toBeGreaterThan(0.3);

  // Drag it up onto the top of the upper tier: it snaps onto that surface
  // (height 1.96 of 3.0) and turns to face up.
  await drag(page, [0.52, 0.64], [0.5, 0.375]);
  const top = await rose();
  expect(top.attachment.point[1]).toBeCloseTo(1.96 / 3, 2);
  expect(top.attachment.normal[1]).toBeGreaterThan(0.9);
  expect(top.attachment.offset).toBe(0);

  // Rotate and resize with the handles that travel with the flower.
  const handle = async (name: string, pixels: number) => {
    const box = (await page
      .getByRole("button", { name, exact: true })
      .boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + pixels, box.y + 10, {
      steps: 5,
    });
    await page.mouse.up();
  };
  await handle("Rotate", 80);
  await handle("Resize", 60);
  const adjusted = await rose();
  expect(adjusted.rotation).not.toEqual(top.rotation);
  expect(adjusted.scale).toBeCloseTo(top.scale * Math.exp(60 / 160), 1);
  expect(adjusted.attachment).toEqual(top.attachment);

  // Duplicate: an independent flower beside the first, still on the surface.
  await page.keyboard.press("ControlOrMeta+d");
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Garden rose copy",
  );
  cake = await exported(page);
  expect(cake.objects).toHaveLength(2);
  expect(cake.objects[1].id).not.toBe(cake.objects[0].id);
  expect(cake.objects[1].attachment.surface).toBe("model");
  expect(cake.objects[1].attachment.point).not.toEqual(
    cake.objects[0].attachment.point,
  );
  expect(cake.objects[0].attachment).toEqual(top.attachment);
  // Delete the duplicate; the original is untouched.
  await page.keyboard.press("Delete");
  cake = await exported(page);
  expect(cake.objects).toHaveLength(1);
  expect(cake.objects[0].attachment).toEqual(top.attachment);

  // Resizing the model carries the flower with it: the attachment is stored
  // relative to the mesh, so nothing about it changes.
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await page
    .getByRole("button", { name: "Generated cake", exact: true })
    .click();
  await page.getByLabel("Model width (in)", { exact: true }).fill("10");
  cake = await exported(page);
  expect(cake.generatedModels[0].diameter).toBe(10);
  // The hidden tiers that carry servings and price scale with the model.
  expect(cake.tiers.map((t: { diameter: number }) => t.diameter)).toEqual([
    7.5, 5,
  ]);
  expect(cake.objects[0].attachment).toEqual(top.attachment);

  // The reference photograph can be compared against the model.
  await page
    .getByRole("button", { name: "Reference photo", exact: true })
    .click();
  await expect(page.getByAltText("Reference photograph")).toBeVisible();
  await page.getByLabel("Reference opacity").fill("0.3");
  await page.screenshot({ path: ".artifacts/studio-generated-model.png" });

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Design saved", { exact: true })).toBeVisible();
  const saved = await exported(page);
  await expect(page).toHaveURL(new RegExp(`/studio/${saved.cakeId}$`));
  await page.reload();
  await page.locator("canvas").waitFor();
  // Reopening reproduces the same cake: model, parts, flower and reference.
  await expect(page.getByLabel("Model name", { exact: true })).toHaveValue(
    "Generated cake",
  );
  expect(await exported(page)).toEqual(saved);
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await page.getByRole("button", { name: "Garden rose", exact: true }).click();
  await expect(page.getByLabel("Scale", { exact: true })).toHaveValue(
    String(Math.round(adjusted.scale * 1000) / 1000),
  );
  expect(errors).toEqual([]);
});

test("without a configured provider the studio says so and generates nothing", async ({
  page,
}) => {
  await page.route("**/api/studio/image-to-3d", (route) =>
    route.fulfill({ json: { configured: false, maxViews: 0 } }),
  );
  await page.goto("/studio");
  await page.locator("canvas").waitFor();
  const before = await exported(page);
  await page.getByRole("button", { name: /Create from Cake Image/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Image-to-3D service not configured",
  );
  await page
    .getByLabel("Front view photograph")
    .setInputFiles("public/images/cake-collection.png");
  await expect(
    page.getByRole("button", { name: "Generate 3D model", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  // No stand-in cake appears: the design on the canvas is untouched.
  expect(await exported(page)).toEqual(before);
  await expect(page.getByLabel("Design name")).toHaveValue(
    "Aisha Floral Birthday",
  );
});

test("an existing GLB can be imported as the base model, and multiple views use multi-view generation", async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  await page.goto("/studio");
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: /Create from Cake Image/ }).click();
  await page.getByLabel("Import a GLB model").setInputFiles({
    name: "my-cake.glb",
    mimeType: "model/gltf-binary",
    buffer: buildCakeGlb(),
  });
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByLabel("Model name", { exact: true })).toHaveValue(
    "Imported cake",
  );
  let cake = await exported(page);
  expect(cake.generatedModels[0].source).toBe("imported");
  expect(cake.referenceImages).toEqual([]);

  const before = await (
    await request.get("http://127.0.0.1:5181/stats")
  ).json();
  await page.getByRole("tab", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: /Create from Cake Image/ }).click();
  for (const view of ["Front", "Left", "Back"])
    await page
      .getByLabel(`${view} view photograph`)
      .setInputFiles("public/images/cake-collection.png");
  await page
    .getByRole("button", { name: "Generate 3D model", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30000 });
  const after = await (await request.get("http://127.0.0.1:5181/stats")).json();
  expect(after.multiView - before.multiView).toBe(1);
  cake = await exported(page);
  expect(cake.generatedModels[0].source).toBe("generated");
  expect(cake.referenceImages.map((r: { view: string }) => r.view)).toEqual([
    "front",
    "left",
    "back",
  ]);
});
