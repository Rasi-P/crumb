import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const base = process.argv[2];
if (!base || !base.startsWith("https://"))
  throw new Error("Provide the HTTPS deployment URL.");
const { OWNER_PASSWORD } = parseEnv(
  readFileSync(".env.deployment.local", "utf8"),
);
assert.ok(OWNER_PASSWORD, "The local owner credential is missing.");
const session = await fetch(`${base}/api/session`);
assert.equal(session.status, 200);
assert.deepEqual(await session.json(), { authenticated: false, local: false });
assert.equal((await fetch(`${base}/api/state`)).status, 401);
const quote = await (
  await fetch(`${base}/api/quotes/luna-aisha-floral-2026`)
).json();
assert.equal(quote.quote.total, 3800);
assert.equal(quote.customers, undefined);
assert.equal(quote.payments, undefined);
console.log(
  "PASS: Production authentication is enforced and customer quotations expose only their scoped data.",
);

mkdirSync(".artifacts", { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Workspace password").fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: "Open your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Good morning, Sarah" }),
  ).toBeVisible({ timeout: 30000 });
  const cookie = (await context.cookies()).find(
    (c) => c.name === "crumb_session",
  );
  assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Strict");
  await page.screenshot({
    path: ".artifacts/deployed-dashboard.png",
    fullPage: true,
  });
  const initial = await (await context.request.get(`${base}/api/state`)).json();
  assert.ok(initial.designs.length >= 17);
  // Save an unchanged business record to verify writes without introducing demo debris.
  const write = await context.request.post(`${base}/api/command`, {
    data: {
      revision: initial.revision,
      command: { type: "business.save", value: initial.business },
    },
  });
  assert.equal(write.status(), 200);
  const updated = await write.json();
  assert.equal(updated.revision, initial.revision + 1);
  const persisted = await (
    await context.request.get(`${base}/api/state`)
  ).json();
  assert.equal(persisted.revision, updated.revision);
  console.log("PASS: Secure owner login and durable production writes.");
  for (const path of [
    "/orders/order-1048",
    "/customers",
    "/catalog",
    "/inventory",
    "/calendar",
    "/analytics",
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".page-content")).toBeVisible();
    assert.ok(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    );
  }
  await page.goto(`${base}/studio/design-aisha`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(3000);
  const pixels = await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext("webgl2")!;
      const buffer = new Uint8Array(
        gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
      );
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        buffer,
      );
      let colored = 0;
      for (let i = 0; i < buffer.length; i += 4)
        if (buffer[i] < 230 && buffer[i + 1] < 225 && buffer[i + 2] < 230)
          colored++;
      return colored;
    });
  assert.ok(pixels > 10000);
  await page.screenshot({ path: ".artifacts/deployed-studio.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  assert.ok(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
  );
  await page
    .locator(".studio-mobile-toolbar")
    .getByRole("button", { name: "Customize", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Cake properties and pricing" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: ".artifacts/deployed-studio-mobile.png" });
  await page.goto(`${base}/q/luna-aisha-floral-2026`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".public-heading")).toBeVisible();
  assert.ok(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
  );
  await context.request.post(`${base}/api/logout`);
  const loggedOut = await (
    await context.request.get(`${base}/api/session`)
  ).json();
  assert.equal(loggedOut.authenticated, false);
  assert.deepEqual(errors, []);
  console.log(
    `PASS: Deep links, 3D rendering (${pixels} cake pixels), mobile Studio, public quote, and logout. No browser errors.`,
  );
} finally {
  await browser.close();
}
