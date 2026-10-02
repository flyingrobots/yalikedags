import { test, expect } from "@playwright/test";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";

const tasks = Array.from({ length: 73 }, (_, i) => new Task({ id: String(i + 1), title: `Task ${String(i + 1).padStart(3, "0")}`, assignee: i < 30 ? "Sam" : "Alex" }));
const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse(tasks, "Pagination fixture");
test.beforeEach(async ({ page }) => {
  await page.route("**/viewer.json", (route) => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
  await page.goto("http://127.0.0.1:4178");
});

test("ready work and workstreams paginate; ownership filters reset and apply to all tasks", async ({ page }) => {
  const ready = page.getByRole("navigation", { name: "Ready work pagination" });
  await expect(page.locator("#frontier > li:visible")).toHaveCount(25);
  await expect(ready).toContainText("1–25 of 73");
  await ready.getByRole("button", { name: "Last", exact: true }).click();
  await expect(page.locator("#frontier > li:visible")).toHaveCount(23);
  await expect(ready.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByLabel("Ready work owner").selectOption("name:Sam");
  await expect(ready).toContainText("1–25 of 30");
  await ready.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("#frontier > li:visible")).toHaveCount(5);
  await page.getByRole("button", { name: "Waves", exact: true }).click();
  await expect(page.locator("#grid-table tbody tr:visible")).toHaveCount(25);
  await page.getByLabel("Workstreams page size").selectOption("50");
  await expect(page.locator("#grid-table tbody tr:visible")).toHaveCount(50);
  await page.getByLabel("Waves owner").selectOption("name:Sam");
  await expect(page.locator("#grid-table tbody tr:visible")).toHaveCount(30);
});

test("table pages cover each task once and filtering and sorting use the full dataset", async ({ page }) => {
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const pager = page.getByRole("navigation", { name: "Tasks pagination" });
  const seen: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    seen.push(...await page.locator("#task-table tbody .task-title").allTextContents());
    if (i < 2) { await pager.getByRole("button", { name: "Next", exact: true }).click(); }
  }
  expect(seen).toHaveLength(73); expect(new Set(seen).size).toBe(73);
  await page.getByRole("button", { name: "Sort by Title" }).click();
  await expect(page.locator("#task-table tbody .task-title").first()).toHaveText("Task 073");
  await page.getByRole("searchbox", { name: "Filter tasks" }).fill("Task 001");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(1);
  await page.locator("#task-table tbody .task-title").click();
  await expect(page.locator("#detail h2")).toHaveText("Task 001");
  await page.getByRole("searchbox", { name: "Filter tasks" }).fill("no matches");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(pager).toContainText("1–25 of 73");
});

test("findings and comparison results page within their groups", async ({ page }) => {
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  const group = page.locator(".finding-group").filter({ hasText: "isolated" });
  await expect(group.locator("ul > li:visible")).toHaveCount(25);
  await group.getByRole("button", { name: "Last", exact: true }).click();
  await expect(group.locator("ul > li:visible")).toHaveCount(23);
  await page.getByRole("button", { name: "Import/Export", exact: true }).click();
  await page.getByLabel("Compare snapshot JSON").setInputFiles({ name: "before.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ schema: "yalikedags/snapshot/2", tasks: [] })) });
  const added = page.locator(".change-group").filter({ has: page.getByRole("heading", { name: /Added work/ }) });
  await expect(added.locator("ul > li:visible")).toHaveCount(25);
  await added.getByRole("button", { name: "Next", exact: true }).click();
  await expect(added.getByRole("status")).toContainText("26–50 of 73");
});

test("impact and unscheduled task lists remain bounded and retain inspectable results", async ({ page }) => {
  const graph = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([
    new Task({ id: "root", title: "Root" }),
    ...Array.from({ length: 40 }, (_, i) => new Task({ id: `d${String(i)}`, title: `Dependent ${String(i)}`, blockedBy: ["root"] })),
    ...Array.from({ length: 40 }, (_, i) => new Task({ id: `u${String(i)}`, title: `Unknown ${String(i)}`, blockedBy: ["external"] })),
  ], "Impact fixture");
  await page.route("**/viewer.json", (route) => route.fulfill({ contentType: "application/json", body: new ViewerData().render(graph) }));
  await page.reload();
  const immediate = page.locator(".impact-list").filter({ has: page.locator("summary", { hasText: "Immediately unblocked" }) });
  await immediate.locator("summary").click();
  await expect(immediate.locator("ul > li:visible")).toHaveCount(25);
  await immediate.getByRole("button", { name: "Last", exact: true }).click();
  await expect(immediate.locator("ul > li:visible")).toHaveCount(15);
  await immediate.locator("ul > li:visible button").first().click();
  await expect(page.locator("#detail h2")).toContainText("Dependent");
  await page.getByRole("button", { name: "Waves", exact: true }).click();
  await expect(page.locator("#unscheduled > .card:visible")).toHaveCount(25);
  await page.getByRole("navigation", { name: "Unscheduled tasks pagination" }).getByRole("button", { name: "Last", exact: true }).click();
  await expect(page.locator("#unscheduled > .card:visible")).toHaveCount(15);
});
