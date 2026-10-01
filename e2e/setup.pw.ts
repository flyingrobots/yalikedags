import { test, expect } from "@playwright/test";

for (const reason of ["missing", "rejected"]) {
  test(`credential ${reason} shows a full-height themed setup hero`, async ({ page }) => {
    await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ schema: "yalikedags/setup/1", reason, keyTarget: "LINEAR_API_KEY" }) }));
    await page.goto("http://127.0.0.1:4178");
    await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(reason === "missing" ? "Connect your Linear workspace" : "Linear couldn’t authenticate this key");
    await expect(page.getByLabel("Credential setup command")).toHaveText("export LINEAR_API_KEY='your-linear-api-key'");
    await expect(page.locator(".setup-content")).toContainText("A running process cannot pick up a new shell export");
    await expect(page.locator(".primary-nav")).toHaveCount(0);
    const bounds = await page.locator(".setup-screen").boundingBox();
    expect(bounds?.height).toBe(960); expect(bounds?.width).toBe(1440);
    await expect(page.locator(".setup-art svg")).toHaveCount(1);
    await page.getByRole("button", { name: "Theme and display mode" }).click();
    await page.getByLabel("Display mode", { exact: true }).selectOption("dark");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme-transition", "true");
    const dark = await page.locator(".nose").evaluate(e => getComputedStyle(e).fill);
    await page.getByLabel("Display mode", { exact: true }).selectOption("light");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme-transition", "true");
    expect(await page.locator(".nose").evaluate(e => getComputedStyle(e).fill)).not.toBe(dark);
  });
}

test("custom keychain target is safely quoted and setup scrolls on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ schema: "yalikedags/setup/1", reason: "missing", keyTarget: "example-key's <target>" }) }));
  await page.goto("http://127.0.0.1:4178");
  await expect(page.getByLabel("Credential setup command")).toHaveText("bun src/cli.ts key --set --target 'example-key'\\''s <target>'");
  await expect(page.locator("target")).toHaveCount(0);
  await page.getByRole("button", { name: "Theme and display mode" }).click();
  await expect(page.getByLabel("Display mode", { exact: true })).toBeVisible();
  expect(await page.locator(".setup-screen").evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
});
