import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { DependencyReview } from "../src/core/domain/DependencyReview.ts";
import { ReviewDecision } from "../src/core/domain/ReviewDecision.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { SnapshotBudget } from "../src/adapters/input/SnapshotBudget.ts";
import { JsonSnapshotAdapter } from "../src/adapters/output/JsonSnapshotAdapter.ts";
import { DependencyReviewCodec } from "../src/adapters/review/DependencyReviewCodec.ts";

const analyzer = new AnalysisService({ today: (): string => "2026-10-02" });
const record = (tasks: readonly Task[], exceptions: string[] = []): DependencyReview => new DependencyReview({ sourceVersion: "a".repeat(64), taskIds: tasks.map(t => t.id), basis: "Captured evidence", reviewer: "Example", reviewedAt: "2026-10-02", exceptions,
  decisions: tasks.slice(1).map(t => new ReviewDecision({ blocker: "0", dependent: t.id, outcome: "accepted", note: "n".repeat(60000) })) });

test("full export refuses combined review and source bytes beyond the import budget", () => {
  // oracle: separately admissible records cannot produce an unreopenable recovery snapshot.
  const tasks = Array.from({ length: 81 }, (_, i) => new Task({ id: String(i), title: "Example", description: "d".repeat(60000), blockedBy: i === 0 ? [] : ["0"] }));
  const analysis = analyzer.analyse(tasks, "synthetic");
  const review = record(tasks);
  const renderer = new JsonSnapshotAdapter();
  expect(() => new SnapshotBudget().parse(renderer.render(analysis))).not.toThrow();
  expect(() => new SnapshotBudget().parse(JSON.stringify(new DependencyReviewCodec().encode(review)))).not.toThrow();
  expect(() => renderer.render(analysis, review)).toThrow("maximum file size");
});

test("full export enforces the combined JSON structure budget", () => {
  // oracle: small strings can still exceed the import node budget once review evidence is included.
  const tasks = [new Task({ id: "a", title: "Example", labels: Array.from({ length: 99000 }, (_, i) => String(i)) })];
  const analysis = analyzer.analyse(tasks, "synthetic");
  const review = record(tasks, Array.from({ length: 1000 }, (_, i) => `Evidence ${String(i)}`));
  const renderer = new JsonSnapshotAdapter();
  expect(() => new SnapshotBudget().parse(renderer.render(analysis))).not.toThrow();
  expect(() => new SnapshotBudget().parse(JSON.stringify(new DependencyReviewCodec().encode(review)))).not.toThrow();
  expect(() => renderer.render(analysis, review)).toThrow("maximum structure");
});

test("admissible review input cannot expand into an unreopenable HTML or served snapshot", async () => {
  // oracle: derived fields can exceed the structure budget even when the original input and review fit.
  const { JsonSnapshotRepositoryAdapter } = await import("../src/adapters/input/JsonSnapshotRepositoryAdapter.ts");
  const { HtmlRendererAdapter } = await import("../src/adapters/output/HtmlRendererAdapter.ts");
  const { ViewerData } = await import("../src/viewer/ViewerData.ts");
  const task = new Task({ id: "a", title: "Example", labels: Array.from({ length: 99000 }, (_, i) => String(i)) });
  const review = record([task], Array.from({ length: 960 }, (_, i) => `Evidence ${String(i)}`));
  const input = JSON.stringify({ schema: "yalikedags/snapshot/2", tasks: [task.toFields()], dependencyReview: new DependencyReviewCodec().encode(review) });
  const source = new JsonSnapshotRepositoryAdapter(input, "synthetic");
  const analysis = analyzer.analyse(await source.load(), source.describe(), { review: source.review });
  expect(source.review).toEqual(review);
  expect(() => { new HtmlRendererAdapter().render(analysis); }).toThrow("maximum structure");
  expect(() => { new ViewerData().render(analysis); }).toThrow("maximum structure");
});

test("HTML and served snapshot payloads enforce their combined byte budget", async () => {
  // oracle: every producer rejects oversized embedded review data before reporting a usable viewer.
  const { HtmlRendererAdapter } = await import("../src/adapters/output/HtmlRendererAdapter.ts");
  const { ViewerData } = await import("../src/viewer/ViewerData.ts");
  const tasks = Array.from({ length: 81 }, (_, i) => new Task({ id: String(i), title: "Example", description: "d".repeat(60000), blockedBy: i === 0 ? [] : ["0"] }));
  const analysis = analyzer.analyse(tasks, "synthetic", { review: record(tasks) });
  expect(() => { new HtmlRendererAdapter().render(analysis); }).toThrow("maximum file size");
  expect(() => { new ViewerData().render(analysis); }).toThrow("maximum file size");
});
