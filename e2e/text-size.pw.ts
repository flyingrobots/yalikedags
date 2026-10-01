import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";

const url = pathToFileURL(resolve("dist/viewer-text-size.html")).href;
test.beforeAll(() => {
  mkdirSync("dist", { recursive: true });
  const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([new Task({ id: "a", title: "Example task" })], "Example");
  writeFileSync("dist/viewer-text-size.html", new HtmlRendererAdapter().render(analysis));
});

test("relative text slider resizes navigation immediately, persists, and resets", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "Theme and display mode" }).click();
  const slider = page.getByRole("slider", { name: "Text size", exact: true });
  await expect(slider).toHaveValue("1");
  const initialWidth = await page.locator("#navigation").evaluate(e => e.getBoundingClientRect().width);
  expect(initialWidth).toBeGreaterThanOrEqual(240);
  await slider.focus(); await page.keyboard.press("End");
  await expect(page.locator("#text-size-value")).toHaveText("150%");
  expect(await page.locator("#navigation").evaluate(e => e.getBoundingClientRect().width)).toBeCloseTo(initialWidth * 1.5, 0);
  expect(await page.locator("html").evaluate(e => e.style.getPropertyValue("--base-font-size"))).toBe("150%");
  await page.reload();
  await page.getByRole("button", { name: "Theme and display mode" }).click();
  await expect(slider).toHaveValue("1.5");
  await page.getByRole("button", { name: "Reset text size" }).click();
  await expect(slider).toHaveValue("1");
  await expect(page.locator("#text-size-value")).toHaveText("100%");
});

test("legacy text size migrates and mobile navigation stays within the viewport", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("yalikedags.text-size", "20"); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.getByRole("button", { name: "Theme and display mode" }).click();
  const slider = page.getByRole("slider", { name: "Text size", exact: true });
  await expect(slider).toHaveValue("1.25");
  await slider.focus(); await page.keyboard.press("End");
  expect(await page.locator("#navigation").evaluate(e => e.getBoundingClientRect().width)).toBe(390);
  expect(await page.locator("html").evaluate(e => e.scrollWidth)).toBeLessThanOrEqual(390);
});
