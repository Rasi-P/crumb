import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
let violations = 0;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  for (const path of [
    "/",
    "/orders",
    "/orders/order-1048",
    "/customers",
    "/catalog",
    "/inventory",
    "/expenses",
    "/calendar",
    "/analytics",
    "/settings",
    "/studio",
    "/q/luna-aisha-floral-2026",
  ]) {
    await page.goto(`http://localhost:5173${path}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .locator(".page-content,.public-heading,.studio-shell")
      .first()
      .waitFor();
    await page.waitForTimeout(250);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    violations += result.violations.length;
    console.log(
      JSON.stringify({
        path,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes
            .slice(0, 20)
            .map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      }),
    );
  }
} finally {
  await browser.close();
}
if (violations) process.exitCode = 1;
