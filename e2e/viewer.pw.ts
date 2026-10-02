import { workspaceAction } from "./workspace.ts";
import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { writeFixtures } from "./fixtures.ts";

const exported = pathToFileURL(resolve("dist/viewer-test.html")).href;

test.beforeAll(() => {
  execFileSync("bun", ["src/cli.ts", "render", "--tasklist", "examples/example-tasklist.txt", "--format", "html", "--out", "dist/viewer-test.html"]);
  writeFixtures();
});

test("dragging pans without selecting and wheel zoom preserves a finite viewport", async ({ page }) => {
  await page.goto(exported);
  await workspaceAction(page, "Show DAG");
  const svg = page.locator("#graph svg");
  const before = await svg.getAttribute("viewBox");
  const bounds = await svg.boundingBox();
  if (bounds === null) { throw new Error("graph is not visible"); }
  await page.mouse.move(bounds.x + 80, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 200, bounds.y + 160, { steps: 5 });
  await page.mouse.up();
  await expect(svg).not.toHaveAttribute("viewBox", before ?? "");
  await expect(page.locator("#graph .node.selected")).toHaveCount(0);
  await page.mouse.wheel(0, -300);
  const box = (await svg.getAttribute("viewBox"))?.split(" ").map(Number);
  expect(box?.every(Number.isFinite)).toBe(true);
});


test("empty projects, hostile text, and unavailable storage remain usable offline", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new Error("storage unavailable"); } });
  });
  await page.goto(pathToFileURL(resolve("dist/viewer-empty.html")).href);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#graph-panel")).toContainText("No tasks");
  await workspaceAction(page, "Show wave grid");
  await expect(page.locator("#grid")).toContainText("Nothing schedulable");
  await page.goto(pathToFileURL(resolve("dist/viewer-escaping.html")).href);
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find a task" }).fill("Unsafe");
  await page.locator("#search-results button").first().click();
  await expect(page.locator("#detail h2")).toContainText("</script><img");
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator("#graph .node.selected")).toHaveCount(1);
  expect(errors).toEqual([]);
});


test("a crowded graph is searchable and a narrow screen keeps controls reachable", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto(pathToFileURL(resolve("dist/viewer-crowded.html")).href);
  await workspaceAction(page, "Show DAG");
  await page.getByRole("searchbox", { name: "Find a task" }).fill("PRO-150");
  await page.locator("#search-results button").first().click();
  await expect(page.locator("#detail h2")).toHaveText("Example task 150");
  await workspaceAction(page, "Show DAG");
  await expect(page.locator("#graph .node.selected")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test("task table sorts and filters while retaining the wave grid", async ({ page }) => {
  await page.goto(exported);
  await workspaceAction(page, "Show DAG");
  await workspaceAction(page, "Show task table");
  await page.getByRole("searchbox", { name: "Filter tasks" }).fill("parser");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator("#task-table thead th[aria-sort=descending]")).toContainText("Title");
  await page.locator("#task-table tbody button").first().click();
  await expect(page.locator("#detail h2")).toContainText("parser");
  await workspaceAction(page, "Show wave grid");
  await expect(page.locator("#grid")).toBeVisible();
});


test("offline comparison explains added blockers without sending the selected file anywhere", async ({ page }) => {
  const requests: string[] = [];
  await page.goto(exported);
  await workspaceAction(page, "Show DAG");
  page.on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "Import/Export", exact: true }).click();
  await expect(page.getByRole("button", { name: "Refresh source", exact: true })).toBeDisabled();
  await workspaceAction(page, "Import/Export");
  await page.getByLabel("Compare snapshot JSON").setInputFiles({
    name: "earlier.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({
      schema: "yalikedags/snapshot/1", capturedAt: "2026-09-20T10:00:00.000Z",
      tasks: [{ id: "implement-core-dag-builder", title: "Implement core DAG builder", blockedBy: ["old-external"] }],
    })),
  });
  await expect(page.locator("#changes-status")).toContainText("2026-09-20T10:00:00.000Z");
  await expect(page.locator("#changes-list")).toContainText("blocker removed: old-external");
  await expect(page.locator("#changes-list")).toContainText("blocker added:");
  expect(requests).toEqual([]);
});


test("table headers stay flush with their scroll viewport in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 500 });
  await page.goto(exported);
  await workspaceAction(page, "Show DAG");
  for (const { view, selector } of [{ view: "Show task table", selector: "#table-panel .table-scroll" }, { view: "Show wave grid", selector: "#grid" }]) {
    await workspaceAction(page, view);
    const viewport = page.locator(selector);
    await expect(viewport).toBeVisible();
    await viewport.evaluate((el) => { el.scrollTop = 120; el.scrollLeft = 80; });
    const metrics = await viewport.evaluate((el) => {
      const header = el.querySelector("thead th:not([hidden])");
      return { scroll: el.scrollTop, top: el.getBoundingClientRect().top, header: header?.getBoundingClientRect().top };
    });
    expect(metrics.scroll).toBeGreaterThan(0);
    expect(metrics.header).toBeCloseTo(metrics.top, 0);
  }
});


test("standalone SVG gives unresolved nodes a readable state fill", async ({ page }) => {
  // oracle: unresolved nodes use the viewer's pale yellow state color, without viewer CSS.
  await page.goto(pathToFileURL(resolve("dist/unresolved.svg")).href);
  const unresolved = page.locator(".node.unresolved rect");
  await expect(unresolved).toHaveCount(2);
  for (const rect of await unresolved.all()) { await expect(rect).toHaveCSS("fill", "rgb(255, 240, 201)"); }
});


test("failed snapshot comparison clears the previous results", async ({ page }) => {
  // oracle: a rejected file must never display another file's comparison rows.
  await page.goto(exported);
  await workspaceAction(page, "Show DAG");
  await workspaceAction(page, "Import/Export");
  const input = page.getByLabel("Compare snapshot JSON");
  await input.setInputFiles({ name: "valid.json", mimeType: "application/json", buffer: Buffer.from('{"schema":"yalikedags/snapshot/1","tasks":[]}') });
  await expect(page.locator("#changes-status")).toContainText("valid.json");
  expect(await page.locator("#changes-list li").count()).toBeGreaterThan(0);
  await input.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("invalid") });
  await expect(page.locator("#changes-status")).toContainText("Could not compare");
  await expect(page.locator("#changes-list li")).toHaveCount(0);
});

for (const staleText of ['{"schema":"yalikedags/snapshot/1","tasks":[]}', "invalid"]) {
  test(`latest snapshot selection wins over a delayed ${staleText === "invalid" ? "failure" : "success"}`, async ({ page }) => {
    // oracle: controlled file-read scheduling must not change which selection owns the UI.
    await page.goto(exported);
  await workspaceAction(page, "Show DAG");
    await workspaceAction(page, "Import/Export");
    await page.locator("#compare-snapshot").evaluate((input, text) => {
      if (!(input instanceof HTMLInputElement)) { throw new Error("missing input"); }
      class DelayedFile extends File {
        override async text(): Promise<string> {
          await new Promise<void>((release) => { window.addEventListener("release-comparison", () => { release(); }, { once: true }); });
          return text;
        }
      }
      const transfer = new DataTransfer();
      transfer.items.add(new DelayedFile([text], "older.json", { type: "application/json" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change"));
    }, staleText);
    await page.getByLabel("Compare snapshot JSON").setInputFiles({ name: "latest.json", mimeType: "application/json", buffer: Buffer.from('{"schema":"yalikedags/snapshot/1","tasks":[]}') });
    await expect(page.locator("#changes-status")).toContainText("latest.json");
    const rows = await page.locator("#changes-list").textContent();
    await page.evaluate(async () => {
      window.dispatchEvent(new Event("release-comparison"));
      await new Promise<void>((finish) => { requestAnimationFrame(() => { finish(); }); });
    });
    await expect(page.locator("#changes-status")).toContainText("latest.json");
    await expect(page.locator("#changes-list")).toHaveText(rows ?? "");
  });
}


test("releasing outside the graph before the drag threshold does not pan on return", async ({ page }) => {
  // oracle: a released pointer cannot continue an earlier pan gesture.
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(exported);
  await workspaceAction(page, "Show DAG");
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await page.evaluate(() => new Promise<void>((finish) => { requestAnimationFrame(() => { finish(); }); }));
  const svg = page.locator("#graph svg");
  const bounds = await svg.boundingBox();
  if (bounds === null) { throw new Error("graph is not visible"); }
  const before = await svg.getAttribute("viewBox");
  await page.mouse.move(bounds.x + 1, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 2, bounds.y + bounds.height / 2);
  await page.mouse.up();
  await page.mouse.move(bounds.x + 100, bounds.y + bounds.height / 2);
  await expect(svg).toHaveAttribute("viewBox", before ?? "");
  expect(errors).toEqual([]);
});
