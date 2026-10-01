import { test, expect } from "@playwright/test";
import { Task } from "../src/core/domain/Task.ts";
import { LinearAccount } from "../src/core/domain/LinearAccount.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";

const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([
  new Task({ id: "a", title: "My ready task", assignee: "Same Name", assigneeId: "me" }),
  new Task({ id: "b", title: "Other ready task", assignee: "Same Name", assigneeId: "other" }),
  new Task({ id: "c", title: "Immediate dependent", blockedBy: ["a"] }),
  new Task({ id: "d", title: "Distant dependent", blockedBy: ["c"] }),
  new Task({ id: "e", title: "Outside the forecast", blockedBy: ["external"] }),
], "Second pass fixture", { account: new LinearAccount({ id: "me", name: "Same Name" }, { id: "w", name: "Example workspace" }, { id: "p", name: "Example project" }) });

test.beforeEach(async ({ page }) => {
  await page.route("**/viewer.json", (route) => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
  await page.goto("http://127.0.0.1:4178");
});

test("owner filters use stable identity and surface uncertainty and unscheduled work", async ({ page }) => {
  await expect(page.locator(".analysis-warning")).toContainText("incomplete data");
  await expect(page.locator(".project-stats .unresolved")).toContainText("1Unresolved");
  await page.getByLabel("Ready work owner").selectOption("mine");
  await expect(page.locator("#frontier li:visible .card")).toHaveCount(1);
  await expect(page.locator("#frontier li:visible .card")).toContainText("My ready task");
  await page.getByRole("button", { name: "Waves", exact: true }).click();
  await expect(page.locator("#unscheduled")).toContainText("Outside the forecast");
  await expect(page.locator("#grid-table thead")).toContainText("2 tasks");
  await page.getByLabel("Waves owner").selectOption("unassigned");
  await expect(page.locator('#grid [data-task="a"]')).toBeHidden();
  await expect(page.locator('#grid [data-task="c"]')).toBeVisible();
});

function viewport(value: string | null): number[] {
  const [x = 0, y = 0, width = 0, height = 0] = (value ?? "").split(" ").map(Number);
  return [x + width / 2, y + height / 2, width];
}

test("neighborhood relayout expands by hops and preserves the whole-project viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  const before = await page.locator("#graph svg").getAttribute("viewBox");
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Dependencies", exact: true }).click();
  await expect(page.locator("#graph svg")).toHaveAttribute("viewBox", before ?? "");
  await page.locator('#graph [data-id="a"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Focus selection", exact: true }).click();
  const full = await page.locator("#graph svg").getAttribute("viewBox");
  await page.getByRole("button", { name: "Focus neighborhood" }).click();
  await expect(page.locator("#graph .node")).toHaveCount(2);
  await expect(page.locator("#graph-scope-status")).toContainText("2 of 5");
  await page.getByRole("button", { name: "Expand one hop" }).click();
  await expect(page.locator("#graph .node")).toHaveCount(3);
  await page.getByRole("button", { name: "Whole project", exact: true }).click();
  await expect(page.locator("#graph .node")).toHaveCount(5);
  const restored = viewport(await page.locator("#graph svg").getAttribute("viewBox"));
  expect(restored).toEqual(viewport(full).map((value) => expect.closeTo(value, 4)));
});

test("inspector close restores focus and dependency links reveal and center the graph", async ({ page }) => {
  const card = page.locator('#frontier [data-task="a"]');
  await card.focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Close task details" }).click();
  await expect(card).toBeFocused();
  await card.click();
  await page.locator('#detail [data-task="c"]').click();
  await expect(page.locator("#graph-panel")).toBeVisible();
  await expect(page.locator('#graph [data-id="c"]')).toHaveClass(/selected/);
});

test("table titles are actionable and optional columns persist", async ({ page }) => {
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.locator('#task-table th[data-column="Estimate"]')).toBeHidden();
  await page.locator("#table-columns summary").click();
  await page.getByRole("checkbox", { name: "Estimate", exact: true }).check();
  await expect(page.locator('#task-table th[data-column="Estimate"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('#task-table th[data-column="Estimate"]')).toBeVisible();
  await page.getByRole("button", { name: "My ready task", exact: true }).click();
  await expect(page.locator("#detail h2")).toHaveText("My ready task");
});

test("structural findings open a focused chain and changes group assignment events", async ({ page }) => {
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Structural problems/ })).toBeVisible();
  await page.getByRole("button", { name: "Inspect affected chain · Outside the forecast" }).first().click();
  await expect(page.locator("#graph-panel")).toBeVisible();
  await expect(page.locator("#graph .node")).toHaveCount(1);
  await page.getByRole("button", { name: "Import/Export", exact: true }).click();
  await page.getByLabel("Compare snapshot JSON").setInputFiles({ name: "before.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ schema: "yalikedags/snapshot/2", capturedAt: "2026-09-01T00:00:00Z", tasks: [new Task({ id: "a", title: "My ready task", assignee: "Previous owner", assigneeId: "previous" }).toFields()] })) });
  await expect(page.getByRole("heading", { name: /Assignments/ })).toBeVisible();
  await expect(page.locator("#changes-list")).toContainText("Previous owner → Same Name");
  await expect(page.locator("#comparison-before")).toContainText("before.json · 2026-09-01");
});

test("impact disclosures identify immediate and downstream tasks and open their details", async ({ page }) => {
  const entry = page.locator('#frontier > li').filter({ has: page.locator('[data-task="a"].card') });
  const immediate = entry.locator('details').filter({ has: page.locator('summary', { hasText: 'Immediately unblocked' }) });
  const downstream = entry.locator('details').filter({ has: page.locator('summary', { hasText: 'Downstream' }) });
  await immediate.locator('summary').click();
  await expect(immediate.locator('li button')).toHaveText(['Immediate dependent']);
  await downstream.locator('summary').click();
  await expect(downstream.locator('li button')).toHaveText(['Immediate dependent', 'Distant dependent']);
  await downstream.getByRole('button', { name: 'Distant dependent' }).click();
  await expect(page.locator('#detail h2')).toHaveText('Distant dependent');
});

test("navigation stays visible and details collapse without clearing selection", async ({ page }) => {
  await page.evaluate(() => { localStorage.setItem('yalikedags.nav-collapsed', 'true'); });
  await page.reload();
  await expect(page.locator('#navigation')).toBeVisible();
  await expect(page.locator('#toggle-navigation')).toHaveCount(0);
  await page.locator('#frontier [data-task="a"].card').click();
  await page.getByRole('button', { name: 'Task details', exact: true }).click();
  await expect(page.locator('#inspector')).toBeHidden();
  await expect(page.locator('#frontier [data-task="a"].card')).toHaveClass(/selected/);
  await page.getByRole('button', { name: 'Task details', exact: true }).click();
  await expect(page.locator('#detail h2')).toHaveText('My ready task');
  await page.getByRole('button', { name: 'Close task details' }).click();
  await expect(page.getByRole('button', { name: 'Task details', exact: true })).toBeHidden();
});

test("larger adjustable text persists and mobile controls stay within the viewport", async ({ page }) => {
  await expect(page.locator('html')).toHaveCSS('font-size', '16px');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#frontier [data-task="a"].card').click();
  await page.getByRole('button', { name: 'Theme and display mode' }).click();
  await page.getByRole('slider', { name: 'Text size', exact: true }).focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 15; step += 1) { await page.keyboard.press('ArrowRight'); }
  await expect(page.locator('html')).toHaveCSS('font-size', '20px');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveCSS('font-size', '20px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.brand-caption,.overview-heading,#view-subtitle,.nav-number')).toHaveCount(0);
});
