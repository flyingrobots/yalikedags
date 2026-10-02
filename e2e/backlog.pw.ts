import { test, expect } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sparseBacklog } from "../test/fixtures/sparseBacklog.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";
function analysis(extra = false): ReturnType<AnalysisService["analyse"]> {
  return new AnalysisService({ today: (): string => "2026-01-01", now: (): string => extra ? "2026-01-01T13:00:00Z" : "2026-01-01T12:00:00Z" }).analyse(sparseBacklog(extra), "Synthetic backlog");
}
test.beforeAll(() => {
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/sparse-backlog.html", new HtmlRendererAdapter().render(analysis()));
});
test("large export preserves every card and edge and opens at a readable scale", async ({ page }) => {
  await page.goto(`${pathToFileURL(resolve("dist/sparse-backlog.html")).href}#/dependencies`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dependencies");
  await expect(page.locator("#graph .node")).toHaveCount(225);
  await page.getByLabel("Graph state", { exact: true }).selectOption("all");
  await expect(page.locator("#graph .node")).toHaveCount(250);
  await expect(page.locator("#graph .edge")).toHaveCount(49);
  const geometry = await page.locator("#graph > svg").evaluate(svg => {
    const nodes = Array.from(svg.querySelectorAll<SVGGElement>(".node"));
    const boxes = nodes.map(node => { const rect = node.querySelector("rect"); if (rect === null) { throw new Error("Missing card"); } return rect.getBoundingClientRect(); });
    let overlap = false;
    for (const [i, a] of boxes.entries()) { for (const b of boxes.slice(i + 1)) { overlap ||= a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; } }
    return { ids: new Set(nodes.map(node => node.dataset["id"])).size, overlap, width: boxes[0]?.width ?? 0 };
  });
  expect(geometry.ids).toBe(250); expect(geometry.overlap).toBe(false); expect(geometry.width).toBeGreaterThanOrEqual(300);
  await page.getByRole("button", { name: "Unconnected cards", exact: true }).click();
  await expect(page.locator('#graph [data-id="sample-100"]')).toBeInViewport();
  await page.locator('#graph [data-id="sample-100"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#detail")).toContainText("Synthetic work 100");
  await page.getByRole("button", { name: "Focus neighborhood", exact: true }).click();
  await expect(page.locator("#graph .node")).toHaveCount(1);
  await page.getByRole("button", { name: "Whole project", exact: true }).click();
  await expect(page.locator("#graph .node")).toHaveCount(250);
  await expect(page.locator('#graph [data-id="sample-100"]')).toBeInViewport();
  await page.setViewportSize({ width: 1000, height: 760 });
  await expect(page.locator('#graph [data-id="sample-100"]')).toBeInViewport();
  await page.getByLabel("Graph state", { exact: true }).selectOption("done");
  await expect(page.locator("#graph .node")).toHaveCount(25);
  await expect(page.locator("#graph .node").first()).toBeInViewport();
  await page.getByRole("button", { name: "Start here", exact: true }).click();
  await expect(page.locator(".planning-warning")).toContainText("10 tracking container");
  await expect(page.locator(".planning-warning")).toContainText("does not establish independence");
  await expect(page.locator('#frontier [data-id="sample-200"]')).toHaveCount(0);
});
test("served routes and refresh preserve controls, update counts, and report retained capture on failure", async ({ page }) => {
  let refreshed = false;
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis(refreshed), { refresh: true }) }));
  await page.route("**/refresh", route => { refreshed = true; return route.fulfill({ body: "{}", contentType: "application/json" }); });
  await page.goto("http://127.0.0.1:4178/dependencies");
  await expect(page.locator("#snapshot-counts")).toContainText("250 total cards");
  await page.getByLabel("Graph state", { exact: true }).selectOption("all");
  await page.locator('#graph [data-id="sample-0"]').dispatchEvent("click");
  await page.getByRole("button", { name: "Refresh source", exact: true }).click();
  await expect(page.locator("#snapshot-counts")).toContainText("253 total cards");
  await expect(page.locator("#snapshot-capture")).toContainText("13:00:00");
  await expect(page.getByLabel("Graph state", { exact: true })).toHaveValue("all");
  await expect(page.locator('#graph [data-id="sample-0"]')).toHaveClass(/selected/);
  await page.unroute("**/refresh");
  await page.route("**/refresh", route => route.fulfill({ status: 502, body: "unavailable" }));
  await page.getByRole("button", { name: "Refresh source", exact: true }).click();
  await expect(page.locator("#refresh-status")).toContainText("previous snapshot captured 2026-01-01T13:00:00Z");
  await expect(page.locator("#graph .node")).toHaveCount(253);
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dependencies");
});
test("every page has a reloadable route with back and forward navigation", async ({ page }) => {
  const pages = [["start", "Start here"], ["dependencies", "Dependencies"], ["waves", "Waves"], ["tasks", "Tasks"], ["findings", "Findings"], ["import-export", "Import/Export"]];
  for (const [slug, title] of pages) {
    await page.goto(`http://127.0.0.1:4178/${slug ?? ""}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title ?? "");
  }
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Import/Export");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Findings");
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Import/Export");
  await page.goto(`${pathToFileURL(resolve("dist/sparse-backlog.html")).href}#/tasks`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tasks");
  await page.getByRole("button", { name: "Waves", exact: true }).click();
  await expect(page).toHaveURL(/#\/waves$/);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tasks");
});

test("entering a previously hidden graph opens complete readable cards", async ({ page }) => {
  await page.goto(`${pathToFileURL(resolve("dist/sparse-backlog.html")).href}#/start`);
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  const first = page.locator('#graph [data-id="sample-20"] rect');
  await expect(first).toBeInViewport({ ratio: .99 });
  await expect.poll(() => first.evaluate(e => e.getBoundingClientRect().width)).toBeLessThan(400);
  await expect.poll(() => first.evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(300);
});
