import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { HtmlRendererAdapter } from "../src/adapters/output/HtmlRendererAdapter.ts";
import { FixedClockAdapter } from "../test/fakes/FixedClockAdapter.ts";
import { writeFileSync, mkdirSync } from "node:fs";

test("offline viewer exposes canceled prerequisite obligations without offering the dependent as ready", async ({ page }) => {
  // oracle: the exported graph retains canceled evidence and explains why its consumer cannot be scheduled.
  const a = new AnalysisService(new FixedClockAdapter("2026-10-02")).analyse([
    new Task({ id: "schema", title: "Schema", status: "canceled" }),
    new Task({ id: "consumer", title: "Consumer", blockedBy: ["schema"] }),
    new Task({ id: "downstream", title: "Downstream", blockedBy: ["consumer"] }),
  ], "Synthetic cancellation");
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/cancellation.html", new HtmlRendererAdapter().render(a));
  await page.goto(pathToFileURL(resolve("dist/cancellation.html")).href);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#frontier [data-task]")).toHaveCount(0);
  await page.getByRole("button", { name: "Waves", exact: true }).click();
  await expect(page.locator("#unscheduled summary")).toContainText("2 tasks");
  await page.locator('#unscheduled [data-task="downstream"]').click();
  await expect(page.locator("#detail")).toContainText("Unresolved prerequisite obligations");
  await expect(page.locator("#detail")).toContainText("schema");
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.locator("#findings")).toContainText("Canceled prerequisite schema");
});

test("in-progress task details retain execution status and unresolved canceled output", async ({ page }) => {
  // oracle: execution status is preserved, but starting work does not satisfy a canceled prerequisite.
  const a = new AnalysisService(new FixedClockAdapter("2026-10-02")).analyse([
    new Task({ id: "schema", title: "Schema", status: "canceled" }),
    new Task({ id: "working", title: "Working consumer", status: "in-progress", blockedBy: ["schema"] }),
  ], "Synthetic in-progress cancellation");
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/cancellation-working.html", new HtmlRendererAdapter().render(a));
  await page.goto(pathToFileURL(resolve("dist/cancellation-working.html")).href);
  await expect(page.locator("body")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.locator('.task-title[data-task="working"]').click();
  await expect(page.locator("#detail")).toContainText("in-progress");
  await expect(page.locator("#detail")).toContainText("Unresolved prerequisite obligations");
  await expect(page.locator("#detail")).toContainText("schema");
});
