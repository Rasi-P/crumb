import { chromium, expect, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
mkdirSync(".artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
});
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const inspectCanvas = async (canvas: Locator) => {
  const pixels = await canvas.evaluate((el: HTMLCanvasElement) => {
    const gl = el.getContext("webgl2");
    if (!gl) throw new Error("No WebGL context");
    const bytes = new Uint8Array(
      gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
    );
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bytes,
    );
    let colored = 0;
    for (let i = 0; i < bytes.length; i += 4)
      if (bytes[i] < 230 && bytes[i + 1] < 225 && bytes[i + 2] < 230) colored++;
    return {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      coloredPixels: colored,
      totalPixels: bytes.length / 4,
    };
  });
  expect(pixels.coloredPixels).toBeGreaterThan(10000);
  console.log("3D canvas", pixels);
};
try {
  for (const [name, path] of [
    ["dashboard", "/"],
    ["orders", "/orders"],
    ["order-detail", "/orders/order-1048"],
    ["customers", "/customers"],
    ["customer-detail", "/customers/customer-1"],
    ["catalog", "/catalog"],
    ["calendar", "/calendar"],
    ["inventory", "/inventory"],
    ["expenses", "/expenses"],
    ["analytics", "/analytics"],
    ["settings", "/settings"],
    ["studio", "/studio"],
    ["customer-quote", "/q/luna-aisha-floral-2026"],
  ]) {
    await page.goto(`http://localhost:5173${path}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator(".page-content,.studio-shell,.public-heading")
      .first()
      .waitFor();
    await page.waitForTimeout(name === "studio" ? 2500 : 600);
    await page.screenshot({
      path: `.artifacts/${name}-desktop.png`,
      fullPage: true,
    });
    console.log(
      name,
      await page.locator("body").evaluate((el) => ({
        width: el.scrollWidth,
        viewport: innerWidth,
        text: (el as HTMLElement).innerText.slice(0, 70),
      })),
    );
    if (name === "studio") {
      const canvas = page.locator("canvas");
      console.log(
        "3D canvas:",
        await canvas.evaluate((el: HTMLCanvasElement) => {
          const gl = el.getContext("webgl2");
          if (!gl) return { error: "No WebGL context" };
          const bytes = new Uint8Array(
            gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
          );
          gl.readPixels(
            0,
            0,
            gl.drawingBufferWidth,
            gl.drawingBufferHeight,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            bytes,
          );
          let colored = 0;
          for (let i = 0; i < bytes.length; i += 4)
            if (bytes[i] < 230 && bytes[i + 1] < 225 && bytes[i + 2] < 230)
              colored++;
          return {
            width: gl.drawingBufferWidth,
            height: gl.drawingBufferHeight,
            coloredPixels: colored,
            totalPixels: bytes.length / 4,
          };
        }),
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, path] of [
    ["dashboard", "/"],
    ["orders", "/orders"],
    ["order-detail", "/orders/order-1048"],
    ["customers", "/customers"],
    ["catalog", "/catalog"],
    ["calendar", "/calendar"],
    ["inventory", "/inventory"],
    ["analytics", "/analytics"],
    ["studio", "/studio"],
    ["customer-quote", "/q/luna-aisha-floral-2026"],
  ]) {
    await page.goto(`http://localhost:5173${path}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator(".page-content,.studio-shell,.public-heading")
      .first()
      .waitFor();
    await page.waitForTimeout(name === "studio" ? 1800 : 600);
    await page.screenshot({
      path: `.artifacts/${name}-mobile.png`,
      fullPage: true,
    });
    if (name === "studio") await inspectCanvas(page.locator("canvas"));
    console.log(
      `${name} mobile`,
      await page
        .locator("body")
        .evaluate((el) => ({ width: el.scrollWidth, viewport: innerWidth })),
    );
  }
  await page.setViewportSize({ width: 834, height: 1194 });
  for (const [name, path] of [
    ["dashboard", "/"],
    ["studio", "/studio"],
  ]) {
    await page.goto(`http://localhost:5173${path}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".page-content,.studio-shell").first().waitFor();
    await page.waitForTimeout(name === "studio" ? 2000 : 600);
    await page.screenshot({
      path: `.artifacts/${name}-tablet.png`,
      fullPage: true,
    });
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth),
    ).toBeLessThanOrEqual(834);
    if (name === "studio") await inspectCanvas(page.locator("canvas"));
  }
  expect(errors).toEqual([]);
  console.log("PAGE ERRORS", errors);
} finally {
  await browser.close();
}
