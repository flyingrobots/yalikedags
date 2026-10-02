import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.beforeAll(() => {
  execFileSync("bun", ["src/cli.ts", "render", "--tasklist", "examples/example-tasklist.txt", "--format", "html", "--out", "dist/viewer-redesign.html"]);
});

test("the workspace opens on actionable work and gives the graph the full canvas", async ({ page }) => {
  // oracle: the README's first question is what can start; details occupy space only on selection.
  await page.goto("http://127.0.0.1:4178");
  await expect(page.getByRole("heading", { name: "Start here", exact: true })).toBeVisible();
  await expect(page.locator("#frontier .card")).toHaveCount(2);
  await expect(page.locator("#details-panel")).toBeHidden();
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await expect(page.locator("#graph")).toBeVisible();
  const bounds = await page.locator("#graph").boundingBox();
  expect(bounds?.width).toBeGreaterThan(1100);
  await page.getByRole("searchbox", { name: "Find a task" }).fill("Implement core DAG");
  await page.locator("#search-results button").first().click();
  await expect(page.locator("#detail h2")).toContainText("Implement core DAG builder");
  await page.getByRole("button", { name: "Close task details" }).click();
  await expect(page.locator("#details-panel")).toBeHidden();
});

test("ready work and critical path use the snapshot's real analysis", async ({ page }) => {
  await page.goto("http://127.0.0.1:4178");
  await expect(page.locator(".project-stats")).toContainText("2Ready to start");
  await expect(page.locator(".critical-steps li")).toHaveCount(6);
  await expect(page.locator("#frontier .impact").first()).toContainText("7 Downstream");
  await page.locator(".critical-steps button").last().click();
  await expect(page.locator("#detail h2")).toHaveText("Deploy to production");
  await page.keyboard.press("Escape");
  await expect(page.locator("#inspector")).toBeHidden();
});

test("refresh preserves the active view, selection, filters and sorting; failure retains the snapshot", async ({ page }) => {
  await page.goto("http://127.0.0.1:4178");
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("searchbox", { name: "Filter tasks" }).fill("parser");
  await page.getByRole("button", { name: "Sort by Title" }).click();
  await page.locator("#task-table tbody button").first().click();
  const selected = await page.locator("#detail h2").textContent();
  await page.route("**/refresh", (route) => route.fulfill({ status: 502, body: "unavailable" }));
  await page.getByRole("button", { name: "Import/Export" }).click();
  await page.getByRole("button", { name: "Refresh source" }).click();
  await expect(page.locator("#viewer-notice")).toContainText("previous snapshot");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(2);
  await page.unroute("**/refresh");
  await page.getByRole("button", { name: "Import/Export" }).click();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Refresh source" }).click()]);
  await expect(page.locator("#changes-panel")).toBeVisible();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.locator("#detail h2")).toHaveText(selected ?? "");
  await expect(page.getByRole("searchbox", { name: "Filter tasks" })).toHaveValue("parser");
  await expect(page.locator('#task-table th[aria-sort="descending"]')).toHaveText("Title");
  await page.getByRole("button", { name: "Waves", exact: true }).click();
  await page.reload();
  await expect(page.locator("#grid-panel")).toBeVisible();
  await expect(page.locator("#inspector")).toBeHidden();
});

test("keyboard selection, view changes and graph controls work in an offline file without requests", async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  await page.goto(pathToFileURL(resolve("dist/viewer-redesign.html")).href);
  page.on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.locator("#graph .node.ready").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#inspector")).toBeVisible();
  const title = await page.locator("#detail h2").textContent();
  await page.getByRole("button", { name: "Waves", exact: true }).click();
  await expect(page.locator("#grid .card.selected")).toHaveCount(1);
  await expect(page.locator("#detail h2")).toHaveText(title ?? "");
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  const svg = page.locator("#graph svg");
  await page.getByRole("button", { name: "Fit all", exact: true }).click();
  const fitted = await svg.getAttribute("viewBox");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(svg).not.toHaveAttribute("viewBox", fitted ?? "");
  await page.getByRole("button", { name: "Fit all", exact: true }).click();
  await expect(svg).toHaveAttribute("viewBox", fitted ?? "");
  await page.getByRole("button", { name: "Import/Export" }).click();
  await expect(page.getByRole("button", { name: "Refresh source" })).toBeDisabled();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("mobile navigation and inspector remain reachable without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { localStorage.setItem("yalikedags.view.v2", "invalid"); });
  await page.goto("http://127.0.0.1:4178");
  await expect(page.getByRole("heading", { name: "Start here", exact: true })).toBeVisible();
  await page.locator("#frontier .card").first().click();
  await expect(page.getByRole("button", { name: "Close task details" })).toBeVisible();
  await page.getByRole("button", { name: "Close task details" }).click();
  await page.getByRole("button", { name: "Import/Export", exact: true }).click();
  await expect(page.getByLabel("Compare snapshot JSON")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("table filters remain scoped to Tasks and leave other views intact", async ({ page }) => {
  await page.goto("http://127.0.0.1:4178");
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("searchbox", { name: "Filter tasks" }).fill("parser");
  for (const [name, selector] of [["Dependencies", "#graph .node"], ["Waves", "#grid .card"]] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(await page.locator(selector).count()).toBeGreaterThan(2);
    await expect(page.locator(`${selector}.filtered-out`)).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("#table-count")).toContainText("Tasks only");
  await expect(page.locator("#task-table tbody tr")).toHaveCount(12);
});
