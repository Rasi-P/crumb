import { defineConfig } from "@playwright/test";
const run = Date.now();
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5180",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-angle=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  webServer: [
    {
      // Speaks the image-to-3D provider's HTTP API so generation runs through
      // the real adapter without a paid key. See tests/e2e/mock-provider.mjs.
      command: "PORT=5181 node tests/e2e/mock-provider.mjs",
      url: "http://127.0.0.1:5181/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: `DATABASE_PATH=.data/e2e-${run}.sqlite STUDIO_ASSET_PATH=.data/e2e-assets-${run} MESHY_API_KEY=e2e-key MESHY_API_BASE_URL=http://127.0.0.1:5181 IMAGE_TO_3D_PROVIDER=meshy PORT=5180 npm run dev`,
      url: "http://localhost:5180/api/session",
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
