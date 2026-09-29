import { dockWaveGrid, workspaceAction } from "./workspace.ts";
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

for (const url of ["http://127.0.0.1:4178", exported]) {
  test(`selection, search, grid and controls work at ${url.startsWith("file") ? "file" : "server"}`, async ({ page }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url() !== url && !request.url().startsWith(`${url}/`)) { external.push(request.url()); }
    });
    await page.goto(url);
    await expect(page.getByRole("button", { name: "Fit all", exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Find a task" }).fill("Implement core DAG");
    await page.locator("#search-results button").first().click();
    await expect(page.locator("#detail h2")).toContainText("Implement core DAG builder");
    await expect(page.locator("#graph .node.selected")).toHaveCount(1);
    await workspaceAction(page, "Show wave grid");
    await expect(page.locator("#grid .card.selected")).toHaveCount(1);
    await workspaceAction(page, "Show DAG");
    const svg = page.locator("#graph svg");
    await page.getByRole("button", { name: "Fit all", exact: true }).click();
    const fitted = await svg.getAttribute("viewBox");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(svg).not.toHaveAttribute("viewBox", fitted ?? "");
    await page.getByRole("button", { name: "Fit all", exact: true }).click();
    await expect(svg).toHaveAttribute("viewBox", fitted ?? "");
    await page.keyboard.press("Escape");
    await expect(page.locator("#graph .node.selected")).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test("panels can be rearranged, restored and reset without losing selection", async ({ page }) => {
  await page.goto(exported);
  await page.getByRole("searchbox", { name: "Find a task" }).fill("Implement core DAG");
  await page.locator("#search-results button").first().click();
  await expect(page.getByRole("button", { name: "Split views", exact: true })).toHaveCount(0);
  await dockWaveGrid(page);
  await expect(page.locator("#graph")).toBeVisible();
  await expect(page.locator("#grid")).toBeVisible();
  await expect(page.locator("#grid .card.selected")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#graph")).toBeVisible();
  await expect(page.locator("#grid")).toBeVisible();
  await workspaceAction(page, "Reset layout");
  await expect(page.locator("#graph")).toBeVisible();
  await expect(page.locator("#grid")).not.toBeVisible();
});

test("closing and reopening panels retains shared selection; nodes work from the keyboard", async ({ page }) => {
  await page.goto(exported);
  const node = page.locator('#graph .node[data-id="implement-core-dag-builder"]');
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#detail h2")).toContainText("Implement core DAG builder");
  await page.getByRole("button", { name: "Close DAG", exact: true }).click();
  await workspaceAction(page, "Show DAG");
  await expect(page.locator("#graph .node.selected")).toHaveCount(1);
});

test("dragging pans without selecting and wheel zoom preserves a finite viewport", async ({ page }) => {
  await page.goto(exported);
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
  await page.getByRole("searchbox", { name: "Find a task" }).fill("Unsafe");
  await page.locator("#search-results button").first().click();
  await expect(page.locator("#detail h2")).toContainText("</script><img");
  await expect(page.locator("img")).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await workspaceAction(page, "Reset layout");
  await expect(page.locator("#graph .node.selected")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("a crowded graph is searchable and a narrow screen keeps controls reachable", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto(pathToFileURL(resolve("dist/viewer-crowded.html")).href);
  await page.getByRole("searchbox", { name: "Find a task" }).fill("PRO-150");
  await page.locator("#search-results button").first().click();
  await expect(page.locator("#detail h2")).toHaveText("Example task 150");
  await workspaceAction(page, "Show DAG");
  await expect(page.locator("#graph .node.selected")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("dragging a tab docks it into a separate visible group", async ({ page }) => {
  await page.goto(exported);
  const group = page.locator(".dv-groupview").first();
  const bounds = await group.boundingBox();
  if (bounds === null) { throw new Error("Missing docking group"); }
  // Dockview paints panel contents in a sibling overlay above the group's drop surface.
  // Send the real drag to the underlying group's bottom edge without hit-target filtering.
  await page.getByRole("tab", { name: "Wave grid", exact: true }).dragTo(group, {
    force: true, targetPosition: { x: bounds.width / 2, y: bounds.height - 15 },
  });
  await expect(page.locator("#graph")).toBeVisible();
  await expect(page.locator("#grid")).toBeVisible();
});

test("a corrupt saved layout falls back to the default workspace", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("yalikedags.layout.v1", "{invalid"); });
  await page.goto(exported);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#graph")).toBeVisible();
  await expect(page.locator("#frontier")).toBeVisible();
});

test("task table sorts and filters while retaining the wave grid", async ({ page }) => {
  await page.goto(exported);
  await workspaceAction(page, "Show task table");
  await page.getByRole("searchbox", { name: "Filter tasks" }).fill("parser");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await expect(page.locator("#task-table thead th[aria-sort=ascending]")).toContainText("Title");
  await page.locator("#task-table tbody button").first().click();
  await expect(page.locator("#detail h2")).toContainText("parser");
  await workspaceAction(page, "Show wave grid");
  await expect(page.locator("#grid")).toBeVisible();
});

test("served refresh preserves selection, filters, sorting and docked layout; failure preserves the page", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get: () => { throw new Error("Storage denied"); } }); });
  await page.goto("http://127.0.0.1:4178");
  await workspaceAction(page, "Show task table");
  await page.getByRole("searchbox", { name: "Filter tasks", exact: true }).fill("parser");
  await page.getByRole("button", { name: "Sort by Title", exact: true }).click();
  await page.locator("#task-table tbody tr button").first().click();
  const selection = await page.locator("#detail h2").textContent();
  await expect(page.getByRole("button", { name: "Split views", exact: true })).toHaveCount(0);
  await dockWaveGrid(page);
  const capture = await page.locator("#captured-at").textContent();
  await page.route("**/refresh", (route) => route.fulfill({ status: 502, body: "unavailable" }));
  await workspaceAction(page, "Refresh source");
  await expect(page.locator("#refresh-status")).toContainText("previous snapshot");
  await expect(page.locator("#detail h2")).toHaveText(selection ?? "");
  await page.unroute("**/refresh");
  await workspaceAction(page, "Refresh source");
  await expect(page.locator("#captured-at")).not.toHaveText(capture ?? "");
  await expect(page.locator("#detail h2")).toHaveText(selection ?? "");
  await expect(page.locator("#graph")).toBeVisible();
  await expect(page.locator("#grid")).toBeVisible();
  await workspaceAction(page, "Show task table");
  await expect(page.getByRole("searchbox", { name: "Filter tasks", exact: true })).toHaveValue("parser");
  await expect(page.locator('#task-table th[aria-sort="ascending"]')).toHaveText("Title");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(2);
});

test("offline comparison explains added blockers without sending the selected file anywhere", async ({ page }) => {
  const requests: string[] = [];
  await page.goto(exported);
  page.on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "Views menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Refresh source", exact: true })).toBeDisabled();
  await workspaceAction(page, "Changes");
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

test("closing the task table preserves filters and does not break selection elsewhere", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(exported);
  await workspaceAction(page, "Show task table");
  await page.getByRole("searchbox", { name: "Filter tasks", exact: true }).fill("parser");
  await page.getByRole("button", { name: "Close Task table", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find a task" }).fill("Implement core DAG");
  await page.locator("#search-results button").first().click();
  await expect(page.locator("#detail h2")).toContainText("Implement core DAG builder");
  await workspaceAction(page, "Show task table");
  await expect(page.getByRole("searchbox", { name: "Filter tasks", exact: true })).toHaveValue("parser");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("table headers stay flush with their scroll viewport in both directions", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 500 });
  await page.goto(exported);
  for (const { view, selector } of [{ view: "Show task table", selector: "#table-panel .table-scroll" }, { view: "Show wave grid", selector: "#grid" }]) {
    await workspaceAction(page, view);
    const viewport = page.locator(selector);
    await expect(viewport).toBeVisible();
    await viewport.evaluate((el) => { el.scrollTop = 120; el.scrollLeft = 80; });
    const metrics = await viewport.evaluate((el) => {
      const header = el.querySelector("thead th:nth-child(2)");
      return { scroll: el.scrollTop, top: el.getBoundingClientRect().top, header: header?.getBoundingClientRect().top };
    });
    expect(metrics.scroll).toBeGreaterThan(0);
    expect(metrics.header).toBeCloseTo(metrics.top, 0);
  }
});

test("task rows use the same state colors as DAG nodes, including selected rows", async ({ page }) => {
  await page.goto(exported);
  const colors = await page.locator("#graph .node").evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute("data-id"), color: getComputedStyle(node.querySelector("rect")!).fill })));
  await workspaceAction(page, "Show task table");
  for (const row of await page.locator("#task-table tbody tr").all()) {
    const id = await row.getAttribute("data-id");
    expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(colors.find((entry) => entry.id === id)?.color);
  }
  const first = page.locator("#task-table tbody tr").first();
  await first.getByRole("button").click();
  await expect(first).toHaveClass(/selected/);
  const selectedId = await first.getAttribute("data-id");
  expect(await first.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(colors.find((entry) => entry.id === selectedId)?.color);
});

test("workspace controls live in a dismissible keyboard-accessible header dropdown", async ({ page }) => {
  await page.goto(exported);
  const toggle = page.getByRole("button", { name: "Views menu", exact: true });
  await expect(page.locator(".workspace-toolbar")).toHaveCount(0);
  await expect(page.locator("header").getByRole("button", { name: "Views menu", exact: true })).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Show task table", exact: true }).click();
  await expect(page.locator("#task-table")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Show DAG", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.locator(".brand").click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("the banner can be hidden and restored without losing access to Views", async ({ page }) => {
  await page.goto(exported);
  const before = await page.locator("#workspace").boundingBox();
  await workspaceAction(page, "Hide banner");
  await expect(page.locator("header")).toBeHidden();
  await expect(page.locator("footer").getByRole("button", { name: "Views menu", exact: true })).toBeVisible();
  expect((await page.locator("#workspace").boundingBox())!.height).toBeGreaterThan(before!.height);
  await page.reload();
  await expect(page.locator("header")).toBeHidden();
  await workspaceAction(page, "Show banner");
  await expect(page.locator("header")).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "Views menu", exact: true })).toBeVisible();
});

test("snapshot metadata and refresh live in Views instead of a page status strip", async ({ page }) => {
  await page.goto("http://127.0.0.1:4178");
  await expect(page.locator(".snapshot-status")).toHaveCount(0);
  await page.getByRole("button", { name: "Views menu", exact: true }).click();
  await expect(page.locator("#workspace-menu").getByRole("button", { name: "Reset layout", exact: true })).toBeVisible();
  await expect(page.locator("#workspace-menu").getByRole("button", { name: "Refresh source", exact: true })).toBeVisible();
  await page.getByText("Snapshot details", { exact: true }).click();
  await expect(page.locator("#workspace-menu #captured-at")).toContainText("Captured");
  await page.route("**/refresh", (route) => route.fulfill({ status: 502, body: "unavailable" }));
  await workspaceAction(page, "Refresh source");
  await expect(page.locator("#workspace-menu")).toBeHidden();
  await expect(page.locator("#viewer-notice")).toBeVisible();
  await expect(page.locator("#viewer-notice")).toContainText("Refresh failed");
});

test("an empty workspace offers a centered reset and restores its empty state on reload", async ({ page }) => {
  await page.goto(exported);
  await workspaceAction(page, "Hide banner");
  for (const title of ["DAG", "Wave grid", "Task table", "Task details", "Ready work", "Findings", "Changes"]) {
    await page.getByRole("button", { name: "Views menu", exact: true }).click();
    await page.locator("#workspace-menu").getByRole("button", { name: new RegExp(title, "i") }).click();
    await page.getByRole("button", { name: `Close ${title}`, exact: true }).click();
  }
  const reset = page.locator("#workspace").getByRole("button", { name: "Reset layout", exact: true });
  await expect(reset).toBeVisible();
  const area = (await page.locator("#workspace").boundingBox())!;
  const control = (await reset.boundingBox())!;
  expect(Math.abs(control.x + control.width / 2 - area.x - area.width / 2)).toBeLessThan(2);
  expect(Math.abs(control.y + control.height / 2 - area.y - area.height / 2)).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("yalikedags.layout.v1"))).toContain('"panels":{}');
  await page.reload();
  await expect(reset).toBeVisible();
  await reset.click();
  await expect(page.locator("#graph")).toBeVisible();
  await expect(reset).toHaveCount(0);
  await expect(page.locator("header")).toBeHidden();
});

test("inspector views collapse to a sidebar and retain that state across reload", async ({ page }) => {
  await page.goto(exported);
  const width = (await page.locator("#graph").boundingBox())!.width;
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.locator("#frontier")).not.toBeVisible();
  expect((await page.locator("#graph").boundingBox())!.width).toBeGreaterThan(width);
  await page.reload();
  await expect(page.locator("#frontier")).not.toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await expect(page.locator("#frontier")).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await workspaceAction(page, "Task details");
  await expect(page.locator("#detail")).toBeVisible();
});

test("group expand and restore work repeatedly, including inspector views", async ({ page }) => {
  await page.goto(exported);
  await dockWaveGrid(page);
  const graphGroup = page.locator(".dv-groupview").filter({ has: page.getByRole("tab", { name: "DAG", exact: true }) });
  await expect.poll(async () => (await page.locator("#graph").boundingBox())!.height).toBeLessThan(600);
  const height = (await page.locator("#graph").boundingBox())!.height;
  for (let round = 0; round < 2; round += 1) {
    await graphGroup.getByRole("button", { name: "Expand view", exact: true }).click();
    await expect.poll(async () => (await page.locator("#graph").boundingBox())!.height).toBeGreaterThan(height);
    await graphGroup.getByRole("button", { name: "Restore view", exact: true }).click();
    await expect(page.locator("#grid")).toBeVisible();
  }
  await workspaceAction(page, "Task details");
  const inspector = page.locator(".dv-groupview").filter({ has: page.getByRole("tab", { name: "Task details", exact: true }) });
  await inspector.getByRole("button", { name: "Expand view", exact: true }).click();
  await expect(page.locator("#detail")).toBeVisible();
  await page.getByRole("button", { name: "Restore view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
});

test("pop-out views stay interactive and return when their window closes", async ({ page }) => {
  await page.goto("http://127.0.0.1:4178");
  await workspaceAction(page, "Show task table");
  const group = page.locator(".dv-groupview").filter({ has: page.getByRole("tab", { name: "Task table", exact: true }) });
  const opened = page.waitForEvent("popup");
  await group.getByRole("button", { name: "Pop out view", exact: true }).click();
  const popup = await opened;
  await popup.locator("#table-query").fill("Implement core DAG");
  await expect(popup.locator("#task-table tbody tr")).toHaveCount(1);
  await popup.locator("#task-table tbody button").click();
  await expect(page.locator("#detail h2")).toContainText("Implement core DAG builder");
  await popup.close({ runBeforeUnload: true });
  await workspaceAction(page, "Show task table");
  await expect(page.locator("#table-query")).toHaveValue("Implement core DAG");
  await workspaceAction(page, "Show DAG");
  const graphWindow = page.waitForEvent("popup");
  await group.getByRole("button", { name: "Pop out view", exact: true }).click();
  const graph = await graphWindow;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  graph.on("pageerror", (error) => errors.push(error.message));
  const before = await graph.locator("#graph svg").getAttribute("viewBox");
  await graph.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect(errors).toEqual([]);
  await expect(graph.locator("#graph svg")).not.toHaveAttribute("viewBox", before!);
  await page.reload();
  await workspaceAction(page, "Show DAG");
  await expect(page.locator("#graph")).toBeVisible();
  await expect.poll(() => graph.isClosed()).toBe(true);
});

test("pop-outs explain offline limits and recover from blocked windows", async ({ page }) => {
  await page.goto(exported);
  await expect(page.getByRole("button", { name: "Pop out view", exact: true }).first()).toBeDisabled();
  await page.goto("http://127.0.0.1:4178");
  await page.evaluate(() => { window.open = (): null => null; });
  await workspaceAction(page, "Task details");
  const sidebar = page.locator(".dv-groupview").filter({ has: page.getByRole("tab", { name: "Task details", exact: true }) });
  await sidebar.getByRole("button", { name: "Pop out view", exact: true }).click();
  await expect(page.locator("#viewer-notice")).toContainText("Allow pop-ups");
  await expect(sidebar.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
  await expect(page.locator("#detail")).toBeVisible();
});

test("sidebar pop-outs return to the sidebar and reset closes their windows", async ({ page }) => {
  await page.goto("http://127.0.0.1:4178");
  await workspaceAction(page, "Task details");
  const sidebar = page.locator(".dv-groupview").filter({ has: page.getByRole("tab", { name: "Task details", exact: true }) });
  for (const reset of [false, true]) {
    const opened = page.waitForEvent("popup");
    await sidebar.getByRole("button", { name: "Pop out view", exact: true }).click();
    const popup = await opened;
    await expect(popup.locator("#detail")).toBeVisible();
    if (reset) { await workspaceAction(page, "Reset layout"); }
    else { await popup.close({ runBeforeUnload: true }); }
    await expect.poll(() => popup.isClosed()).toBe(true);
    await workspaceAction(page, "Task details");
    await expect(page.locator("#detail")).toBeVisible();
    await expect(sidebar.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
  }
});

test("reload redocks popped-out sidebar views while preserving a split layout", async ({ page }) => {
  await page.goto("http://127.0.0.1:4178");
  await dockWaveGrid(page);
  await workspaceAction(page, "Task details");
  const sidebar = page.locator(".dv-groupview").filter({ has: page.getByRole("tab", { name: "Task details", exact: true }) });
  const opened = page.waitForEvent("popup");
  await sidebar.getByRole("button", { name: "Pop out view", exact: true }).click();
  const popup = await opened;
  await expect(popup.locator("#detail")).toBeVisible();
  await page.reload();
  await expect(page.locator("#graph")).toBeVisible();
  await expect(page.locator("#grid")).toBeVisible();
  await workspaceAction(page, "Task details");
  await expect(page.locator("#detail")).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
});

test("standalone SVG gives unresolved nodes a readable state fill", async ({ page }) => {
  // oracle: unresolved nodes use the viewer's pale yellow state color, without viewer CSS.
  await page.goto(pathToFileURL(resolve("dist/unresolved.svg")).href);
  const unresolved = page.locator(".node.unresolved rect");
  await expect(unresolved).toHaveCount(2);
  for (const rect of await unresolved.all()) { await expect(rect).toHaveCSS("fill", "rgb(255, 240, 201)"); }
});

test("DAG nodes remain readable when reloading with the DAG closed", async ({ page }) => {
  // oracle: reopening a saved closed DAG must retain a readable node width (at least 120 px).
  await page.goto(exported);
  await page.getByRole("button", { name: "Close DAG", exact: true }).click();
  await workspaceAction(page, "Show task table");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("yalikedags.layout.v1"))).toContain('"activeView":"table"');
  await page.reload();
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#task-table")).toBeVisible();
  await workspaceAction(page, "Show DAG");
  await expect.poll(async () => (await page.locator("#graph .node rect").first().boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(120);
});

test("table filters update closed DAG and wave-grid panels", async ({ page }) => {
  // oracle: reopening either panel preserves the table's two parser matches.
  await page.goto(exported);
  await page.getByRole("button", { name: "Close DAG", exact: true }).click();
  await workspaceAction(page, "Show wave grid");
  await page.getByRole("button", { name: "Close Wave grid", exact: true }).click();
  await workspaceAction(page, "Show task table");
  await page.getByRole("searchbox", { name: "Filter tasks", exact: true }).fill("parser");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(2);
  for (const [action, selector] of [["Show DAG", "#graph .node"], ["Show wave grid", "#grid .card"]] as const) {
    await workspaceAction(page, action);
    await expect(page.locator(`${selector}:not(.filtered-out)`)).toHaveCount(2);
    expect(await page.locator(`${selector}.filtered-out`).count()).toBeGreaterThan(0);
  }
});
