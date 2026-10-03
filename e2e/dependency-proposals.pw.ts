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

test("imported rationale-free acceptance discloses its unresolved evidence", async ({ page }) => {
  // oracle: refusing plan export must also explain the imported acceptance's visible review exception.
  const { DependencyReview } = await import("../src/core/domain/DependencyReview.ts");
  const { ReviewDecision } = await import("../src/core/domain/ReviewDecision.ts");
  const { ReviewIdentityAdapter } = await import("../src/adapters/review/ReviewIdentityAdapter.ts");
  const review = new DependencyReview({ sourceVersion: await new ReviewIdentityAdapter().identify(analysis), taskIds: analysis.dag.tasks.map(t => t.id), basis: "Imported claim", reviewer: "Example", reviewedAt: "2026-10-02", exceptions: [],
    decisions: [new ReviewDecision({ blocker: "schema", dependent: "consumer", outcome: "accepted", note: "" })] });
  const imported = new AnalysisService({ today: (): string => "2026-10-02" }).analyse(analysis.dag.tasks, analysis.source, { account: analysis.account, review });
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(imported) }));
  await page.goto("http://127.0.0.1:4178");
  await expect(page.locator("#dependency-review-status")).toContainText("1 exceptions");
  await expect(page.locator("#dependency-review-status")).toContainText("accepted candidate lacks an evidence and direction rationale");
});

test("accepted preview does not reuse decisions from a stale imported scope", async ({ page }) => {
  // oracle: preview and plan export must agree that incomplete scope makes saved acceptance historical.
  const { DependencyReview } = await import("../src/core/domain/DependencyReview.ts");
  const { ReviewDecision } = await import("../src/core/domain/ReviewDecision.ts");
  const { ReviewIdentityAdapter } = await import("../src/adapters/review/ReviewIdentityAdapter.ts");
  const review = new DependencyReview({ sourceVersion: await new ReviewIdentityAdapter().identify(analysis), taskIds: ["consumer"], basis: "Partial imported claim", reviewer: "Example", reviewedAt: "2026-10-02", exceptions: [],
    decisions: [new ReviewDecision({ blocker: "schema", dependent: "consumer", outcome: "accepted", note: "Required output" })] });
  const imported = new AnalysisService({ today: (): string => "2026-10-02" }).analyse(analysis.dag.tasks, analysis.source, { account: analysis.account, review });
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(imported) }));
  await page.goto("http://127.0.0.1:4178");
  await expect(page.locator("#dependency-review-status")).toContainText("Dependency review is stale");
  await page.locator("#dependency-proposal-tools > summary").click();
  await page.getByLabel("Preview graph", { exact: true }).selectOption("accepted");
  await page.getByRole("button", { name: "Preview selected graph", exact: true }).click();
  await expect(page.locator("#proposal-preview-content")).toContainText("3 recorded ready cards → 3 preview ready cards");
});

test("rediscovery and reopening review preserve unsaved evidence and dispositions", async ({ page }) => {
  const withRecorded = new AnalysisService({ today: (): string => "2026-10-02" }).analyse(
    analysis.dag.tasks.map(task => task.id === "other" ? task.with({ blockedBy: ["schema"] }) : task), analysis.source, { account: analysis.account });
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(withRecorded) }));
  await page.goto("http://127.0.0.1:4178");
  await page.locator("#discover-dependencies").click();
  const candidate = page.locator("[data-candidate]");
  const recorded = page.locator('[data-review-edge]:not([data-candidate])');
  await candidate.selectOption("accepted");
  await page.getByText("Recorded relationship decisions", { exact: true }).click();
  await recorded.selectOption("rejected");
  await page.locator("#dependency-candidates [data-review-note]").fill("Consumer requires the schema output.");
  await page.locator("#review-relationships [data-review-note]").fill("Recorded edge needs correction.");
  await page.getByLabel("Review basis", { exact: true }).fill("Checked both relationships.");
  await page.locator("#review-exceptions").fill("Follow up the recorded relation.");
  for (const button of ["#discover-dependencies", "#review-dependencies"]) {
    await page.locator(button).click();
    await expect(candidate).toHaveValue("accepted");
    await expect(recorded).toHaveValue("rejected");
    await expect(page.locator("#dependency-candidates [data-review-note]")).toHaveValue("Consumer requires the schema output.");
    await expect(page.locator("#review-relationships [data-review-note]")).toHaveValue("Recorded edge needs correction.");
    await expect(page.getByLabel("Review basis", { exact: true })).toHaveValue("Checked both relationships.");
    await expect(page.locator("#review-exceptions")).toHaveValue("Follow up the recorded relation.");
  }
});

test("unsaved proposal evidence identifies its source version and export time", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-02T12:00:00Z"));
  const { ReviewIdentityAdapter } = await import("../src/adapters/review/ReviewIdentityAdapter.ts");
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
  await page.goto("http://127.0.0.1:4178");
  await page.locator("#discover-dependencies").click();
  await page.locator("[data-candidate]").selectOption("accepted");
  await page.locator("#dependency-candidates [data-review-note]").fill("Requires schema output.");
  await page.locator("#dependency-proposal-tools > summary").click();
  const downloading = page.waitForEvent("download");
  await page.locator("#export-proposal-evidence").click();
  const download = await downloading;
  const document: unknown = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(document).toHaveProperty("sourceVersion", await new ReviewIdentityAdapter().identify(analysis));
  expect(document).toHaveProperty("exportedAt", "2026-10-02T12:00:00.000Z");
  await expect(page.locator("#proposal-notice")).toContainText("Evidence bundle exported");
  expect(document).toHaveProperty("candidates", [expect.objectContaining({ blocker: "schema", dependent: "consumer", evidence: "Requires DEMO-1 output before this can merge." })]);
  expect(document).toHaveProperty("decisions", [expect.objectContaining({ outcome: "accepted", note: "Requires schema output." })]);
});

test("oversized evidence bundle is refused while the draft remains available", async ({ page }) => {
  const large = new AnalysisService({ today: (): string => "2026-10-02" }).analyse(Array.from({ length: 81 }, (_, i) =>
    new Task({ id: String(i), title: "Example", description: "x".repeat(60000) })), "synthetic");
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(large) }));
  await page.goto("http://127.0.0.1:4178");
  await page.locator("#review-dependencies").click();
  await page.getByLabel("Review basis", { exact: true }).fill("Draft evidence to retain.");
  await page.locator("#dependency-proposal-tools > summary").click();
  let downloads = 0;
  page.on("download", () => { downloads++; });
  await page.locator("#export-proposal-evidence").click();
  await expect(page.locator("#proposal-notice")).toContainText("maximum file size is 8 MiB");
  await expect(page.getByLabel("Review basis", { exact: true })).toHaveValue("Draft evidence to retain.");
  expect(downloads).toBe(0);
});

test("rejecting a candidate completes its disposition without reporting an unresolved relationship", async ({ page }) => {
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: new ViewerData().render(analysis) }));
  await page.goto("http://127.0.0.1:4178");
  await page.locator("#discover-dependencies").click();
  await page.locator("[data-candidate]").selectOption("rejected");
  await page.locator("#dependency-candidates [data-review-note]").fill("The referenced output is already available externally.");
  await page.getByLabel("Review basis", { exact: true }).fill("Verified the output and reviewed direction.");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed for this source version");
  await expect(page.locator("#dependency-review-status")).toContainText("0 rejected or unreviewed relationships");
  await expect(page.locator("#dependency-review-status")).toContainText("1 candidate rejections completed");
});
