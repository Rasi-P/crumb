import { test, expect } from "@playwright/test";

test("a customer, custom cake, quotation, advance, and delivered order stay connected", async ({
  page,
  context,
}) => {
  await page.goto("/customers");
  await page.getByRole("button", { name: "Add customer", exact: true }).click();
  await page.getByLabel("Full name").fill("Nandita Sethi");
  await page.getByLabel("Phone", { exact: true }).fill("+91 98765 43210");
  await page.getByLabel("Email", { exact: true }).fill("nandita@example.com");
  await page
    .getByLabel("Delivery address")
    .fill("12 Garden Road, Indiranagar, Bengaluru");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add customer" })
    .click();
  await expect(page.getByText("Customer added", { exact: true })).toBeVisible();
  await page.goto("/studio");
  await page
    .locator(".template-grid")
    .getByRole("button", { name: /Minimal White Birthday/ })
    .click();
  await page.getByLabel("Design name").fill("Nandita Garden Celebration");
  await page.getByRole("tab", { name: "Elements", exact: true }).click();
  await page
    .locator(".tier-count-picker")
    .getByRole("button", { name: "2 tiers" })
    .click();
  await page
    .getByRole("button", { name: "Use color #a9baa0", exact: true })
    .click();
  await page
    .locator(".decorations-picker")
    .getByRole("button", { name: "Macarons", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add lettering", exact: true })
    .click();
  await page.getByLabel("Your message").fill("Happy Birthday Nandita");
  await page.getByRole("tab", { name: "Pricing", exact: true }).click();
  await page.getByLabel("Selling price override").fill("4000");
  await page.getByLabel("Delivery fee (₹)").fill("0");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Design saved", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/studio\/[a-f0-9-]{36}(?:\?|$)/);
  await page.reload();
  await expect(page.getByLabel("Design name")).toHaveValue(
    "Nandita Garden Celebration",
  );
  await page.getByRole("tab", { name: "Pricing", exact: true }).click();
  await expect(page.getByLabel("Selling price override")).toHaveValue("4000");
  await page
    .getByRole("button", { name: "Generate quote", exact: true })
    .click();
  await page
    .getByLabel("Prepared for")
    .selectOption({ label: "Nandita Sethi" });
  await page
    .getByRole("button", { name: "Create quotation", exact: true })
    .click();
  await expect(page.getByText("Your quotation is ready")).toBeVisible();
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "Open customer preview" }).click();
  const customerPage = await popupPromise;
  await expect(
    customerPage.getByRole("heading", { name: "Nandita Garden Celebration" }),
  ).toBeVisible();
  await expect(
    customerPage.getByText("Happy Birthday Nandita", { exact: false }).first(),
  ).toBeVisible();
  await customerPage
    .getByRole("button", { name: "I love it. Approve design" })
    .click();
  await customerPage
    .getByRole("dialog")
    .getByRole("button", { name: "Approve design", exact: true })
    .click();
  await expect(
    customerPage.getByText("A lovely choice. Your design is approved."),
  ).toBeVisible();
  await customerPage.close();
  await page.goto("/catalog?tab=quotes");
  const quoteRow = page
    .getByRole("row")
    .filter({ hasText: "Nandita Garden Celebration" });
  await expect(quoteRow.getByText("Approved", { exact: true })).toBeVisible();
  await quoteRow.getByRole("link", { name: "Create order" }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nandita Sethi", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await page.getByLabel("Amount (₹)").fill("1500");
  await page.getByLabel("Reference (optional)").fill("NANDITA-ADVANCE");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record payment", exact: true })
    .click();
  await expect(
    page.getByText("Payment recorded", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".balance-line")).toContainText("₹2,500");
  for (const status of ["Preparing", "Baking", "Decorating", "Ready"]) {
    await page.getByLabel("Order status", { exact: true }).selectOption(status);
    await expect(page.locator(".page-heading .badge")).toHaveText(status);
  }
  await page
    .getByLabel("Order status", { exact: true })
    .selectOption("Completed");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(page.locator(".page-heading .badge")).toHaveText("Completed");
  await page.reload();
  await expect(page.locator(".page-heading .badge")).toHaveText("Completed");
  await expect(page.locator(".balance-line")).toContainText("₹2,500");
  await page.goto("/customers");
  const customerRow = page
    .getByRole("row")
    .filter({ hasText: "Nandita Sethi" });
  await expect(customerRow).toContainText("₹4,000");
  await page.goto("/analytics");
  await expect(page.locator(".stats-grid .stat").first()).toContainText(
    "₹84,500",
  );
});

test("pantry adjustments, stock history, and operating expenses persist", async ({
  page,
}) => {
  await page.goto("/inventory");
  const row = page.getByRole("row").filter({ hasText: "Unsalted butter" });
  await row.getByRole("button", { name: "Stock", exact: true }).click();
  await page.getByLabel("Quantity (kg)").fill("2");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Fresh delivery from the dairy");
  await page.getByRole("button", { name: "Update stock" }).click();
  await expect(
    page.getByText("Inventory updated", { exact: true }),
  ).toBeVisible();
  await row
    .getByRole("button", { name: "History for Unsalted butter" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Fresh delivery from the dairy",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/expenses");
  await page
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  await page
    .getByLabel("What was it for?")
    .fill("Weekend celebration deliveries");
  await page.getByLabel("Amount (₹)").fill("550");
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Delivery");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record expense", exact: true })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "Weekend celebration deliveries" }),
  ).toContainText("₹550");
  await page
    .getByRole("button", { name: "Edit Weekend celebration deliveries" })
    .click();
  await page.getByLabel("Amount (₹)").fill("600");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Weekend celebration deliveries" }),
  ).toContainText("₹600");
});

test("the 3D canvas renders, rotates, resets, and responds to shape changes", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(800);
  const pixels = async () =>
    page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext("webgl2")!;
      const data = new Uint8Array(
        gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
      );
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
      let colored = 0,
        checksum = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 230 && data[i + 1] < 225 && data[i + 2] < 230) colored++;
        checksum =
          (checksum + data[i] * ((i % 103) + 1) + data[i + 1]) % 1000000007;
      }
      return { colored, checksum };
    });
  const initial = await pixels();
  expect(initial.colored).toBeGreaterThan(10000);
  await page
    .locator(".camera-views")
    .getByRole("button", { name: "Side", exact: true })
    .click();
  await page.waitForTimeout(700);
  expect((await pixels()).checksum).not.toBe(initial.checksum);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(700);
  expect((await pixels()).colored).toBeGreaterThan(10000);
  await page.getByRole("tab", { name: "Elements", exact: true }).click();
  for (const shape of ["Square", "Heart", "Number", "Custom", "Round"]) {
    await page
      .locator(".shape-picker")
      .getByRole("button", { name: shape, exact: true })
      .click();
    await page.waitForTimeout(300);
    expect((await pixels()).colored).toBeGreaterThan(3000);
  }
  await page.getByRole("tab", { name: "2D Design", exact: true }).click();
  await expect(page.locator(".design-2d-stage svg")).toBeVisible();
});

test("mobile navigation and studio property sheets stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/orders",
    "/customers",
    "/calendar",
    "/catalog",
    "/inventory",
    "/analytics",
  ]) {
    await page.goto(path);
    await expect(page.locator(".page-content")).toBeVisible();
    expect(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page
    .locator(".mobile-bottom")
    .getByRole("link", { name: "Studio", exact: true })
    .click();
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .locator(".studio-mobile-toolbar")
    .getByRole("button", { name: "Customize", exact: true })
    .click();
  await expect(page.locator(".studio-properties")).toHaveClass(
    /mobile-visible/,
  );
  await page.getByLabel("Tier diameter").fill("7");
  await page.getByRole("button", { name: "Close properties" }).click();
  await expect(page.locator(".studio-properties")).not.toHaveClass(
    /mobile-visible/,
  );
  expect(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
  ).toBe(true);
  await expect(page.locator(".studio-properties")).toHaveAttribute("inert", "");
  await page.setViewportSize({ width: 834, height: 1194 });
  await page
    .locator(".studio-mobile-toolbar")
    .getByRole("button", { name: "Customize", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Cake properties and pricing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close properties" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".studio-properties")).toHaveAttribute("inert", "");
});

test("server conflicts protect newer changes and customer links expose only quotation data", async ({
  request,
}) => {
  const state = await (await request.get("/api/state")).json();
  const value = {
    ...state.customers[0],
    notes: "Verified optimistic concurrency",
  };
  const first = await request.post("/api/command", {
    data: {
      revision: state.revision,
      command: { type: "customer.save", value },
    },
  });
  expect(first.status()).toBe(200);
  const stale = await request.post("/api/command", {
    data: {
      revision: state.revision,
      command: {
        type: "customer.save",
        value: { ...value, notes: "stale overwrite" },
      },
    },
  });
  expect(stale.status()).toBe(409);
  const publicData = await (
    await request.get("/api/quotes/luna-aisha-floral-2026")
  ).json();
  expect(publicData.customer).toEqual({ name: "Aisha Rahman" });
  expect(publicData.payments).toBeUndefined();
  expect(publicData.inventory).toBeUndefined();
  expect(publicData.business.owner).toBeUndefined();
  const stateAfter = await (await request.get("/api/state")).json();
  expect(
    stateAfter.customers.find((c: { id: string }) => c.id === value.id).notes,
  ).toBe("Verified optimistic concurrency");
});
