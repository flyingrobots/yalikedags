import { THEMES } from "../src/viewer/ThemeCatalog.ts";
import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";

const url = "http://127.0.0.1:4178";
const offline = pathToFileURL(resolve("dist/viewer-appearance.html")).href;
test.beforeAll(() => {
  const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([], "Theme preview");
  writeFileSync("dist/viewer-appearance.html", new HtmlRendererAdapter().render(analysis));
});

test("theme choice persists, System follows the OS, and explicit mode overrides it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(url);
  const toggle = page.getByRole("button", { name: "Theme and display mode" });
  await expect(toggle).toContainText("System (dark)");
  await toggle.click();
  await page.getByLabel("Theme", { exact: true }).selectOption("palm");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "palm");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).toContainText("System (light)");
  await page.getByLabel("Display mode", { exact: true }).selectOption("dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(page.locator("#appearance-menu")).toBeHidden();
  await expect(toggle).toBeFocused();
  await page.reload();
  await expect(toggle).toContainText("dark");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "palm");
  await toggle.click();
  await expect(page.getByLabel("Display mode", { exact: true })).toHaveValue("dark");
  await page.getByLabel("Theme", { exact: true }).selectOption("graphite");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "graphite");
});

for (const storage of ["invalid", "unavailable"]) {
  test(`offline and mobile theme controls work with ${storage} storage`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((kind) => {
      if (kind === "invalid") { localStorage.setItem("yalikedags.appearance.v1", '{"palette":"unknown","mode":"broken"}'); }
      else { Object.defineProperty(window, "localStorage", { get: () => { throw new Error("disabled"); } }); }
    }, storage);
    const network: string[] = [];
    page.on("request", (request) => { if (request.url().startsWith("http")) { network.push(request.url()); } });
    await page.goto(offline);
    await page.getByRole("button", { name: "Theme and display mode" }).click();
    await page.getByLabel("Theme", { exact: true }).selectOption("palm");
    await page.getByLabel("Display mode", { exact: true }).selectOption("light");
    await expect(page.locator("#appearance-status")).toContainText("Palm · light mode");
    const bounds = await page.locator("#appearance-menu").boundingBox();
    expect(bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= 390).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(network).toEqual([]);
  });
}

test("every registered palette is selectable and survives a reload", async ({ page }) => {
  await page.goto(url);
  for (const theme of THEMES) {
    await page.getByRole("button", { name: "Theme and display mode" }).click();
    await page.getByLabel("Theme", { exact: true }).selectOption(theme.id);
    await page.getByLabel("Display mode", { exact: true }).selectOption("dark");
    await expect(page.locator("#appearance-status")).toContainText(theme.name);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-palette", theme.id);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  }
});
