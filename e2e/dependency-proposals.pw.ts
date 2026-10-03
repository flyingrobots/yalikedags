import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { LinearAccount } from "../src/core/domain/LinearAccount.ts";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";

const analysis = new AnalysisService({ today: (): string => "2026-10-02" }).analyse([
  new Task({ id: "schema", key: "DEMO-1", title: "Publish schema" }),
  new Task({ id: "consumer", key: "DEMO-2", title: "Consume schema", description: "Requires DEMO-1 output before this can merge." }),
  new Task({ id: "other", key: "DEMO-3", title: "Independent documentation" }),
], "Synthetic discovery", { account: new LinearAccount({ id: "reviewer", name: "Fixture" }, { id: "workspace", name: "Fixture" }, { id: "project", name: "Fixture" }) });

test("description evidence produces a reviewable proposal without changing the recorded graph", async ({ page }) => {
  // oracle: the missing prerequisite is a proposal, not a recorded blocker or automatic tracker write.
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
  await page.goto("http://127.0.0.1:4178");
  await expect(page.getByRole("button", { name: "Discover candidate dependencies", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Discover candidate dependencies", exact: true }).click();
  await expect(page.locator("#dependency-candidates")).toContainText("DEMO-1 → DEMO-2");
  await expect(page.locator("#dependency-candidates")).toContainText("Requires DEMO-1 output before this can merge.");
  await expect(page.locator("#frontier [data-task]")).toHaveCount(3);
  await page.locator("[data-candidate]").selectOption("accepted");
  await page.locator("#dependency-candidates [data-review-note]").fill("The consumer requires the schema output before its PR is correct.");
  await page.getByLabel("Review basis", { exact: true }).fill("Read every task description; confirmed the schema requirement.");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed for this source version");
  await page.locator("#dependency-proposal-tools > summary").click();
  await page.getByLabel("Preview graph", { exact: true }).selectOption("accepted");
  await page.getByRole("button", { name: "Preview selected graph", exact: true }).click();
  await expect(page.locator("#proposal-preview-content")).toContainText("3 recorded ready cards → 2 preview ready cards");
  await expect(page.locator("#frontier [data-task]")).toHaveCount(3);
  await page.reload();
  await page.locator("#dependency-proposal-tools > summary").click();
  await page.getByLabel("Preview graph", { exact: true }).selectOption("accepted");
  await page.getByRole("button", { name: "Preview selected graph", exact: true }).click();
  await expect(page.locator("#proposal-preview-content")).toContainText("3 recorded ready cards → 2 preview ready cards");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download accepted relation plan", exact: true }).click();
  const download = await downloading;
  const path = await download.path();
  const plan: unknown = JSON.parse(await readFile(path, "utf8"));
  expect(plan).toHaveProperty("mutations", [{ kind: "add-blocking-relation", blockerId: "schema", blockedId: "consumer" }]);
  expect(plan).toHaveProperty("currentSource", "linear:project");
  await expect(page.locator("#proposal-notice")).toContainText("Nothing written");
  await expect(page.locator(".proposal-svg svg")).toBeVisible();
  await expect(page.locator("#proposal-arrow")).toHaveCount(1);
  await expect(page.locator("#arrow")).toHaveCount(1);
  await page.screenshot({ path: "test-results/dependency-proposal-preview.png", fullPage: true });

});
