import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { Task } from "../src/core/domain/Task.ts";
import { LinearAccount } from "../src/core/domain/LinearAccount.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";

const description = '# Heading\n\n**Bold** and *italic* with `code`.\n\n- [x] Complete\n- [ ] Pending\n\n| Column | Value |\n| --- | --- |\n| A | B |\n\n```ts\nconst value = 1;\n```\n\n[Docs](https://example.com/docs)\n\n![Diagram](https://example.com/private.png)\n\n<script>window.injected = true</script><img src="https://example.com/tracker" onerror="window.injected=true">\n\n[Bad](javascript:alert(1))';
const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([
  new Task({ id: "a", title: "Markdown task", assignee: "Sam", assigneeId: "me", description }),
  new Task({ id: "b", title: "Blocked task", assignee: "Sam", assigneeId: "me", blockedBy: ["a"] }),
  new Task({ id: "c", title: "Finished task", assignee: "Sam", assigneeId: "other", status: "done" }),
  new Task({ id: "d", title: "Unassigned task" }),
], "Graph fixture", { account: new LinearAccount({ id: "me", name: "Sam" }, { id: "w", name: "Workspace" }, { id: "p", name: "Project" }) });

test.beforeEach(async ({ page }) => {
  await page.route("**/viewer.json", (route) => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
  await page.goto("http://127.0.0.1:4178");
});

test("Readable size centers the selected node and both zoom limits resist further wheel input", async ({ page }) => {
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.locator('#graph [data-id="b"]').focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.getByRole("button", { name: "Readable size" }).click();
  await expect.poll(() => page.locator('#graph .node.selected').evaluate((node) => {
    const rect = node.getBoundingClientRect(); const graph = document.getElementById("graph")?.getBoundingClientRect();
    if (graph === undefined) { return 999; }
    return Math.hypot(rect.x + rect.width / 2 - graph.x - graph.width / 2, rect.y + rect.height / 2 - graph.y - graph.height / 2);
  })).toBeLessThan(2);
  for (const delta of [100, -100]) {
    const svg = page.locator("#graph svg");
    await svg.evaluate((node, deltaY) => { for (let i = 0; i < 120; i += 1) { node.dispatchEvent(new WheelEvent("wheel", { deltaY, cancelable: true })); } }, delta);
    const bound = await svg.getAttribute("viewBox");
    await svg.evaluate((node, deltaY) => { node.dispatchEvent(new WheelEvent("wheel", { deltaY, cancelable: true })); }, delta);
    await expect(svg).toHaveAttribute("viewBox", bound ?? "");
    await expect(page.getByRole("button", { name: delta > 0 ? "Zoom out" : "Zoom in", exact: true })).toBeDisabled();
  }
});

test("graph filters use identity and task state, handle empty results, and search can reveal excluded tasks", async ({ page }) => {
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.getByLabel("Graph owner").selectOption("mine");
  await expect(page.locator("#graph .node")).toHaveCount(2);
  await expect(page.locator('#graph [data-id="c"]')).toHaveCount(0);
  await page.getByLabel("Graph state").selectOption("blocked");
  await expect(page.locator("#graph .node")).toHaveCount(1);
  await expect(page.locator('#graph [data-id="b"]')).toHaveCount(1);
  await page.getByLabel("Graph owner").selectOption("unassigned");
  await expect(page.locator("#graph .node")).toHaveCount(0);
  await expect(page.locator("#graph-filter-status")).toContainText("0 of 4");
  await page.getByRole("searchbox", { name: "Find a task" }).fill("Markdown");
  await page.locator("#search-results button").click();
  await expect(page.locator('#graph [data-id="a"]')).toHaveClass(/selected/);
  await expect(page.getByLabel("Graph owner")).toHaveValue("all");
  await page.getByLabel("Graph state").selectOption("open");
  await expect(page.locator("#graph .node")).toHaveCount(3);
});

test("drawer resizes by drag and keyboard, remembers width, and has one close action", async ({ page }) => {
  await page.locator('#frontier .card[data-task="a"]').click();
  await expect(page.locator(".inspector-heading button")).toHaveCount(1);
  const handle = page.getByRole("separator", { name: "Resize task details" });
  const before = await page.locator("#inspector").evaluate((node) => node.getBoundingClientRect().width);
  const box = await handle.boundingBox(); if (box === null) { throw new Error("Missing resize handle"); }
  await page.mouse.move(box.x + 3, box.y + 80); await page.mouse.down();
  await page.mouse.move(box.x - 177, box.y + 80); await page.mouse.up();
  const width = await page.locator("#inspector").evaluate((node) => node.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(before + 150);
  await handle.focus(); await page.keyboard.press("ArrowLeft");
  await expect.poll(() => page.locator("#inspector").evaluate((node) => node.getBoundingClientRect().width)).toBe(width + 32);
  await page.reload(); await page.locator('#frontier .card[data-task="a"]').click();
  await expect.poll(() => page.locator("#inspector").evaluate((node) => node.getBoundingClientRect().width)).toBe(width + 32);
  await page.getByRole("button", { name: "Close task details" }).click();
  await expect(page.locator("#inspector")).toBeHidden();
});

test("whole table rows select by pointer or keyboard and Markdown renders safely without remote assets", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("example.com")) { requests.push(request.url()); } });
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const row = page.locator('#task-table tr[data-id="a"]');
  await row.locator('[data-column="Assignee"]').click();
  await expect(row).toHaveClass(/selected/);
  const md = page.locator(".task-description");
  await expect(md.locator("h1")).toHaveText("Heading");
  await expect(md.locator("strong")).toHaveText("Bold");
  await expect(md.locator("table td")).toHaveText(["A", "B"]);
  await expect(md.locator("pre code")).toContainText("const value = 1;");
  await expect(md.locator('input[type="checkbox"]')).toHaveCount(2);
  await expect(md.locator("script,img,[onerror]")).toHaveCount(0);
  await expect(md.getByRole("link", { name: "Docs", exact: true })).toHaveAttribute("rel", "noopener noreferrer");
  await expect(md.locator('a[href^="javascript:"]')).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.locator('#task-table tr[data-id="d"]').focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#detail h2")).toHaveText("Unassigned task");
});

test("page chrome places controls in their views and snapshot export retains source data", async ({ page }) => {
  await expect(page.locator("header,.app-header,.header-actions")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "yalikedags home" })).toHaveText("yalikedags?");
  await expect(page.locator(".nav-bottom #appearance-toggle")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Find a task" })).toBeHidden();
  await page.getByRole("button", { name: "Import/Export", exact: true }).click();
  await expect(page.getByRole("button", { name: "Refresh source" })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export snapshot JSON" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("yalikedags-snapshot.json");
  const path = await download.path();
  const snapshot: unknown = JSON.parse(await readFile(path, "utf8"));
  expect(snapshot).toMatchObject({ schema: "yalikedags/snapshot/2", source: "Graph fixture", tasks: expect.arrayContaining([expect.objectContaining({ id: "a", description })]) });
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.locator(".table-scroll")).toHaveCSS("scrollbar-width", "none");
  await expect(page.locator(".nav-bottom #appearance-toggle")).toBeVisible();
});
