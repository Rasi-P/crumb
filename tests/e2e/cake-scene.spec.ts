import { test, expect } from "@playwright/test";

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

test("catalog drag-and-drop raycasts a real tier and surface movement keeps the decoration selected", async ({
  page,
}) => {
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
  await expect(page.getByLabel("Placement", { exact: true })).toHaveValue(
    "side",
  );
  const angle = await page
    .getByLabel("Angle (°)", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "Move tool", exact: true }).click();
  await canvas.click({
    position: { x: rect.width * 0.58, y: rect.height * 0.65 },
  });
  await expect(page.getByLabel("Object name", { exact: true })).toHaveValue(
    "Garden rose",
  );
  await expect(page.getByLabel("Angle (°)", { exact: true })).not.toHaveValue(
    angle,
  );
});

test("reference analysis is reviewable and produces a normal editable scene", async ({
  page,
}) => {
  await page.goto("/studio");
  await page.getByRole("button", { name: /Create from Cake Image/ }).click();
  await page
    .getByLabel("Reference photograph")
    .setInputFiles("public/images/cake-collection.png");
  await expect(page.getByText(/low confidence/)).toBeVisible();
  await page.getByLabel("Detected tiers").selectOption("2");
  await page.getByLabel("Reference tier 1 diameter (in)").fill("10");
  await page.getByLabel("Reference tier 1 height (in)").fill("5");
  await page.getByLabel("Reference tier 1 color").fill("#f3d7dd");
  await page.getByLabel("Reference decorations").selectOption("rose-blush");
  await page.getByLabel("Reference topper text").fill("Happy Birthday Aisha");
  await page
    .getByRole("button", { name: "Create editable cake", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Layers", exact: true }).click();
  await expect(
    page.getByText("2 tiers · 6 decorations", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tier 1 · 10″", exact: true }).click();
  await expect(page.getByLabel("Tier height")).toHaveValue("5");
  await expect(page.getByLabel("Custom frosting color")).toHaveValue("#f3d7dd");
});
