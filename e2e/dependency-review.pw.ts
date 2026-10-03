import { expect, test } from "@playwright/test";

test("a manual dependency review survives unchanged refresh with its bounded claim", async ({ page }) => {
  // oracle: deliberate review records a basis for the captured scope, without asserting all real dependencies exist.
  await page.goto("http://127.0.0.1:4178/");
  await page.getByRole("button", { name: "Review dependencies", exact: true }).click();
  await page.getByLabel("Review basis", { exact: true }).fill("Checked every recorded prerequisite against the task descriptions.");
  await page.getByLabel("Unresolved exceptions", { exact: true }).fill("External deployment approval is not represented by a task.");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed with exceptions");
  await expect(page.locator("#dependency-review-status")).toContainText("External deployment approval");
  await page.reload();
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed with exceptions");
  await expect(page.locator("#dependency-review-status")).toContainText("does not prove");
});

test("changed source makes recorded relationship decisions historical", async ({ page }) => {
  // oracle: evidence changes invalidate accepted decisions while preserving them for inspection.
  const { Task } = await import("../src/core/domain/Task.ts");
  const { AnalysisService } = await import("../src/core/services/AnalysisService.ts");
  const { ViewerData } = await import("../src/viewer/ViewerData.ts");
  const { FixedClockAdapter } = await import("../test/fakes/FixedClockAdapter.ts");
  const analyzer = new AnalysisService(new FixedClockAdapter("2026-10-02"));
  const blocker = new Task({ id: "a", title: "Shared schema" });
  const consumer = new Task({ id: "b", title: "Consumer", blockedBy: ["a"] });
  let data = new ViewerData().render(analyzer.analyse([blocker, consumer], "Review fixture"), { refresh: true });
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: data }));
  await page.goto("http://127.0.0.1:4178/");
  await page.getByRole("button", { name: "Review dependencies", exact: true }).click();
  await page.getByLabel("Review basis", { exact: true }).fill("Consumer needs the schema output.");
  await page.getByText("Recorded relationship decisions", { exact: true }).click();
  await page.getByLabel("Decision for a to b", { exact: true }).selectOption("accepted");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed for this source version");
  data = new ViewerData().render(analyzer.analyse([blocker, consumer.with({ description: "The implementation now uses an unrelated output" })], "Review fixture"), { refresh: true });
  await page.reload();
  await expect(page.locator("#dependency-review-status")).toContainText("Dependency review is stale");
  await page.locator("#dependency-review-status summary").click();
  await expect(page.locator("#dependency-review-status")).toContainText("accepted (historical)");
  await page.getByRole("button", { name: "Review dependencies", exact: true }).click();
  await expect(page.getByLabel("Decision for a to b", { exact: true })).toHaveValue("unreviewed");
});

test("storage failure leaves a usable review with an explicit export recovery", async ({ page }) => {
  // oracle: persistence failure must not claim a durable save or prevent in-page review.
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new DOMException("Storage unavailable", "SecurityError"); } });
  });
  await page.goto("http://127.0.0.1:4178/");
  await page.getByRole("button", { name: "Review dependencies", exact: true }).click();
  await page.getByLabel("Review basis", { exact: true }).fill("Checked recorded relationships.");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.locator("#dependency-review-notice")).toContainText("browser storage failed");
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed with exceptions");
});

test("full exports carry a review claim while structure-only exports omit it", async ({ page }, info) => {
  // oracle: persisted human evidence travels only with an explicit full export and remains an imported claim on reopen.
  const { readFileSync, writeFileSync } = await import("node:fs");
  const { pathToFileURL } = await import("node:url");
  const { JsonSnapshotRepositoryAdapter } = await import("../src/adapters/input/JsonSnapshotRepositoryAdapter.ts");
  const { AnalysisService } = await import("../src/core/services/AnalysisService.ts");
  const { HtmlRendererAdapter } = await import("../src/adapters/output/HtmlRendererAdapter.ts");
  const { FixedClockAdapter } = await import("../test/fakes/FixedClockAdapter.ts");
  await page.goto("http://127.0.0.1:4178/");
  await page.getByRole("button", { name: "Review dependencies", exact: true }).click();
  await page.getByLabel("Review basis", { exact: true }).fill("Reviewed all captured descriptions and recorded prerequisites.");
  await page.getByLabel("Unresolved exceptions", { exact: true }).fill("Approval outside the captured scope remains unresolved.");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await page.screenshot({ path: info.outputPath("review.png") });
  await page.getByRole("button", { name: "Import/Export", exact: true }).click();
  const fullPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export snapshot JSON", exact: true }).click();
  const full = await fullPromise;
  const fullPath = await full.path();
  const source = new JsonSnapshotRepositoryAdapter(readFileSync(fullPath, "utf8"), "Reopened export");
  const tasks = await source.load();
  expect(source.review?.basis).toContain("Reviewed all captured descriptions");
  await page.locator("#export-content").selectOption("structure");
  const structurePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export snapshot JSON", exact: true }).click();
  const structure = await structurePromise;
  const structurePath = await structure.path();
  const redacted = readFileSync(structurePath, "utf8");
  expect(redacted).not.toContain("dependencyReview");
  expect(redacted).not.toContain("Approval outside the captured scope");
  const html = info.outputPath("reviewed.html");
  writeFileSync(html, new HtmlRendererAdapter().render(new AnalysisService(new FixedClockAdapter("2026-10-02")).analyse(tasks, source.describe(), { review: source.review })));
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(html).href);
  await expect(page.locator("#dependency-review-status")).toContainText("Imported review claim (self-reported)");
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed with exceptions");
});

test("imported review cannot hide known source uncertainty", async ({ page }) => {
  // oracle: source-matching self-reported metadata cannot override an unresolved canceled output.
  const { Task } = await import("../src/core/domain/Task.ts");
  const { AnalysisService } = await import("../src/core/services/AnalysisService.ts");
  const { DependencyReview } = await import("../src/core/domain/DependencyReview.ts");
  const { ReviewDecision } = await import("../src/core/domain/ReviewDecision.ts");
  const { ReviewIdentityAdapter } = await import("../src/adapters/review/ReviewIdentityAdapter.ts");
  const { ViewerData } = await import("../src/viewer/ViewerData.ts");
  const analyzer = new AnalysisService({ today: (): string => "2026-10-02" });
  const tasks = [new Task({ id: "a", title: "Canceled output", status: "canceled" }), new Task({ id: "b", title: "Consumer", blockedBy: ["a"] })];
  const source = analyzer.analyse(tasks, "Imported uncertainty");
  const review = new DependencyReview({ sourceVersion: await new ReviewIdentityAdapter().identify(source), taskIds: ["a", "b"], basis: "Claimed complete", exceptions: [], reviewer: "Imported reviewer", reviewedAt: "2026-10-02",
    decisions: [new ReviewDecision({ blocker: "a", dependent: "b", outcome: "accepted", note: "Claimed valid" })] });
  const data = new ViewerData().render(analyzer.analyse(tasks, "Imported uncertainty", { review }));
  await page.route("**/viewer.json", route => route.fulfill({ contentType: "application/json", body: data }));
  await page.goto("http://127.0.0.1:4178/");
  await expect(page.locator("#dependency-review-status")).toContainText("Reviewed with exceptions");
  await expect(page.locator("#dependency-review-status")).not.toContainText("Reviewed for this source version");
});
