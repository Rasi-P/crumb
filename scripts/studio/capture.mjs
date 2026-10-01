import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://localhost:5182/studio");
  await page.locator("canvas").waitFor();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({
    path: process.argv[2] || ".artifacts/studio-rebuild.png",
  });
  const product = await page
    .locator("canvas")
    .evaluate((canvas) => canvas.toDataURL("image/png"));
  writeFileSync(
    ".artifacts/studio-product-render.png",
    Buffer.from(product.split(",")[1], "base64"),
  );
  if (process.argv.includes("--closeup")) {
    await page.getByRole("button", { name: "Close-up", exact: true }).click();
    await page.waitForTimeout(1500);
    await page
      .locator("canvas")
      .screenshot({ path: ".artifacts/studio-realism-closeup.png" });
  }
  if (process.argv.includes("--audit")) {
    await page
      .locator("canvas")
      .screenshot({ path: ".artifacts/studio-product-preview.png" });
    await page.getByRole("tab", { name: "Layers", exact: true }).click();
    await page
      .getByRole("button", { name: "Garden rose", exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    console.log(
      "Selected layers",
      await page
        .locator(".layers-panel button[aria-pressed=true]")
        .allTextContents(),
    );
    await page.screenshot({ path: ".artifacts/studio-object-editing.png" });
    await page.getByRole("tab", { name: "2D Design", exact: true }).click();
    await page.screenshot({ path: ".artifacts/studio-shared-2d.png" });
    await page.getByRole("tab", { name: "3D Preview", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: ".artifacts/studio-rebuild-mobile.png" });
    console.log(
      "Mobile width",
      await page.locator("body").evaluate((e) => e.scrollWidth),
    );
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Visual capture complete; no page errors.");
} catch (error) {
  console.error("Browser errors", errors);
  console.error((await page.locator("body").innerText()).slice(0, 2500));
  await page
    .screenshot({ path: ".artifacts/studio-render-error.png", timeout: 10000 })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
