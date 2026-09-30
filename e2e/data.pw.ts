import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import { Task } from "../src/core/domain/Task.ts";
import { LinearAccount } from "../src/core/domain/LinearAccount.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";

const analysis = new AnalysisService({ today: (): string => "2026-09-30" }).analyse([
  new Task({ id: "a", key: "PRO-1", title: "Assigned example", assignee: "Sam <Example>" }),
  new Task({ id: "b", key: "PRO-2", title: "Unassigned example", blockedBy: ["a"] }),
], "Example project", { account: new LinearAccount(
  { id: "user", name: "Alex Example" }, { id: "workspace", name: "Example workspace" }, { id: "project", name: "Example project" },
) });
const exported = pathToFileURL(resolve("dist/viewer-account.html")).href;

test.beforeAll(() => { writeFileSync("dist/viewer-account.html", new HtmlRendererAdapter().render(analysis)); });

for (const mode of ["server", "offline"]) {
  test(`account and assignment data render safely across ${mode} views`, async ({ page }) => {
    // oracle: the assigned fixture names its owner everywhere; missing assignment is explicitly Unassigned.
    const requests: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));
    if (mode === "server") {
      await page.route("**/viewer.json", (route) => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
    }
    await page.goto(mode === "server" ? "http://127.0.0.1:4178" : exported);
    await expect(page.locator(".account-info")).toContainText("Example workspace");
    await expect(page.locator(".account-info")).toContainText("Captured by Alex Example");
    await expect(page.locator("#frontier .assignee")).toHaveText("Sam <Example>");
    await expect(page.locator(".critical-steps")).toContainText("Sam <Example>");
    await page.locator("#frontier .card").click();
    await expect(page.locator("#detail")).toContainText("Sam <Example>");
    await page.getByRole("button", { name: "Waves", exact: true }).click();
    await expect(page.locator('#grid [data-task="a"] .assignee')).toHaveText("Sam <Example>");
    await expect(page.locator('#grid [data-task="b"] .assignee')).toHaveText("Unassigned");
    await page.getByRole("button", { name: "Dependencies", exact: true }).click();
    await expect(page.locator('#graph [data-id="a"] text').last()).toContainText("Sam <Example>");
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await page.getByLabel("Filter by assignee").selectOption("Sam <Example>");
    await expect(page.locator("#task-table tbody tr")).toHaveCount(1);
    await page.getByLabel("Filter by assignee").selectOption("Unassigned");
    await expect(page.locator("#task-table tbody tr")).toHaveCount(1);
    await expect(page.locator("#task-table tbody")).toContainText("Unassigned");
    await page.getByRole("button", { name: "Import/Export" }).click();
    await page.locator(".snapshot-info summary").click();
    await expect(page.locator(".snapshot-account")).toContainText("Example project");
    await expect(page.locator("example")).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(requests).toHaveLength(mode === "server" ? 2 : 1);
  });
}

test("hosted shell waits for JSON and displays a clear error if it cannot load", async ({ page }) => {
  await page.route("**/viewer.json", (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await page.goto("http://127.0.0.1:4178");
  await expect(page.locator("#app")).toContainText("Could not load workspace data");
  await expect(page.locator(".primary-nav")).toHaveCount(0);
});

test("invalid server data cannot mount partial or unsafe project markup", async ({ page }) => {
  await page.route("**/viewer.json", (route) => route.fulfill({ contentType: "application/json", body: '{"schema":"wrong","snapshot":{"source":"<img src=x>"}}' }));
  await page.goto("http://127.0.0.1:4178");
  await expect(page.locator("#app")).toContainText("Unsupported viewer data schema");
  await expect(page.locator("img")).toHaveCount(0);
});
