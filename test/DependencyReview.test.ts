import { DependencyDiscoveryService } from "../src/core/services/DependencyDiscoveryService.ts";
import { expect, test, spyOn } from "bun:test";
import { ReviewDecision } from "../src/core/domain/ReviewDecision.ts";
import { Task } from "../src/core/domain/Task.ts";
import { DependencyReview } from "../src/core/domain/DependencyReview.ts";
import { DependencyReviewService } from "../src/core/services/DependencyReviewService.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { ReviewIdentityAdapter } from "../src/adapters/review/ReviewIdentityAdapter.ts";
import { DependencyReviewCodec } from "../src/adapters/review/DependencyReviewCodec.ts";
import { JsonSnapshotAdapter } from "../src/adapters/output/JsonSnapshotAdapter.ts";
import { JsonSnapshotRepositoryAdapter } from "../src/adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { StructureOnlyAnalysisAdapter } from "../src/adapters/output/StructureOnlyAnalysisAdapter.ts";
import { ViewerData } from "../src/viewer/ViewerData.ts";
import { ViewerDataCodec } from "../src/viewer/ViewerDataCodec.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const analyzer = new AnalysisService(new FixedClockAdapter("2026-10-02"));
const identity = new ReviewIdentityAdapter();
const service = new DependencyReviewService();
const task = new Task({ id: "a", title: "Output", description: "Produces the shared schema" });
const consumer = new Task({ id: "b", title: "Consumer", blockedBy: ["a"] });
const original = analyzer.analyse([task, consumer], "synthetic");
const review = (version: string, exceptions: string[] = []): DependencyReview => new DependencyReview({ sourceVersion: version, taskIds: ["a", "b"], basis: "Inspected descriptions and prerequisite direction", exceptions, reviewedAt: "2026-10-02T12:00:00Z", reviewer: "Example reviewer", decisions: [new ReviewDecision({ blocker: "a", dependent: "b", outcome: "accepted", note: "Output required by consumer" })] });

test("review completion is explicitly bounded by content and scope", async () => {
  // oracle: no assertion exists before review, and unresolved exceptions survive completion.
  const version = await identity.identify(original);
  expect(service.state(undefined, version, original)).toBe("unreviewed");
  expect(service.state(review(version), version, original)).toBe("reviewed");
  expect(service.state(review(version, ["External approval missing"]), version, original)).toBe("exceptions");
  expect(service.state(review(version), version, analyzer.analyse([task, consumer, new Task({ id: "new", title: "New" })], "synthetic"))).toBe("stale");
  expect(service.state(review(version), version, analyzer.analyse([task], "synthetic"))).toBe("stale");
});

test("prerequisite evidence changes invalidate the review", async () => {
  // oracle: every inspected prerequisite input is part of the content identity.
  const version = await identity.identify(original);
  const changes = [task.with({ title: "Changed" }), task.with({ description: "Changed" }), task.with({ status: "canceled" }),
    task.with({ parent: "parent" }), task.with({ children: ["child"] }), task.with({ labels: ["container"] })];
  for (const changed of changes) {
    const next = await identity.identify(analyzer.analyse([changed, consumer], "synthetic"));
    expect(service.state(review(version), next, original)).toBe("stale");
  }
  const next = await identity.identify(analyzer.analyse([task, consumer.with({ blockedBy: [] })], "synthetic"));
  expect(service.state(review(version), next, original)).toBe("stale");
});

test("unchanged prerequisite evidence survives capture and presentation changes", async () => {
  // oracle: source ordering, capture timestamps, estimates and assignment do not change the reviewed prerequisite facts.
  const next = analyzer.analyse([consumer, task.with({ assignee: "Someone", priority: 1, effort: 8 })], "Renamed display", { capturedAt: "2026-10-03T12:00:00Z" });
  expect(await identity.identify(next)).toBe(await identity.identify(original));
});

test("captured review evidence round-trips through snapshots and viewer data", async () => {
  // oracle: export preserves the assertion and exceptions without converting it to authenticated identity.
  const record = review(await identity.identify(original), ["Missing external evidence"]);
  const a = analyzer.analyse([task, consumer], "synthetic", { review: record });
  const source = new JsonSnapshotRepositoryAdapter(new JsonSnapshotAdapter().render(a), "export");
  await source.load();
  expect(source.review).toEqual(record);
  const decoded = await new ViewerDataCodec().decode(new ViewerData().render(a));
  expect(decoded.analysis.review).toEqual(record);
  expect(await identity.identify(decoded.analysis)).toBe(record.sourceVersion);
  const redacted = new StructureOnlyAnalysisAdapter().transform(a);
  expect(redacted.review).toBeUndefined();
  expect(new JsonSnapshotAdapter().render(redacted)).not.toContain("Example reviewer");
});

test("legacy snapshots remain unreviewed and malformed review claims are rejected", async () => {
  // oracle: missing metadata cannot establish review, and invalid imported evidence never becomes a domain assertion.
  const source = new JsonSnapshotRepositoryAdapter(new JsonSnapshotAdapter().render(original), "legacy");
  await source.load();
  expect(source.review).toBeUndefined();
  const codec = new DependencyReviewCodec();
  expect(() => codec.decode({ schema: "unknown" })).toThrow("unsupported schema");
  const data = codec.encode(review(await identity.identify(original)));
  expect(() => codec.decode({ ...data, taskIds: ["a", "a"] })).toThrow("unique task identities");
  expect(() => codec.decode({ ...data, sourceVersion: "fake" })).toThrow("invalid source identity");
  expect(() => codec.decode({ ...data, basis: "" })).toThrow("basis");
});

test("relationship dispositions are scoped to their evidence version", async () => {
  // oracle: rejection is an exception, and changing evidence makes both acceptance and rejection historical.
  const version = await identity.identify(original);
  for (const outcome of ["accepted", "rejected", "unreviewed"] as const) {
    const record = new DependencyReview({ sourceVersion: version, taskIds: ["a", "b"], basis: "Reviewed source", exceptions: [], reviewedAt: "2026-10-02T12:00:00Z", reviewer: "Example",
      decisions: [new ReviewDecision({ blocker: "a", dependent: "b", outcome, note: "Recorded evidence" })] });
    expect(service.state(record, version, original)).toBe(outcome === "accepted" ? "reviewed" : "exceptions");
    const changed = await identity.identify(analyzer.analyse([task.with({ description: "New evidence" }), consumer], "synthetic"));
    expect(service.state(record, changed, original)).toBe("stale");
  }
  const incomplete = new DependencyReview({ sourceVersion: version, taskIds: ["a", "b"], basis: "Only task descriptions", exceptions: [], reviewedAt: "2026-10-02T12:00:00Z", reviewer: "Example" });
  expect(service.state(incomplete, version, original)).toBe("exceptions");
});

test("imported matching review cannot hide known canceled prerequisite uncertainty", async () => {
  // oracle: a source-matching imported claim with no declared exceptions cannot erase a known missing output.
  const current = analyzer.analyse([task.with({ status: "canceled" }), consumer], "synthetic");
  const version = await identity.identify(current);
  const imported = new DependencyReviewCodec().decode(new DependencyReviewCodec().encode(review(version)));
  expect(service.state(imported, version, current)).toBe("exceptions");
});


test("matching claims retain cycles, missing and unknown blockers, and source warnings", async () => {
  // oracle: current observed uncertainty is never erased by an imported empty exception list.
  const cases = [analyzer.analyse([task.with({ blockedBy: ["b"] }), consumer], "synthetic"),
    analyzer.analyse([task, consumer.with({ blockedBy: ["missing"] })], "synthetic"),
    analyzer.analyse([task.with({ status: "unknown" }), consumer], "synthetic"),
    analyzer.analyse([task, consumer], "synthetic", { warnings: ["Captured source uncertainty"] })];
  for (const current of cases) {
    const version = await identity.identify(current);
    const decisions = current.dag.tasks.flatMap(t => t.blockedBy.map(blocker => new ReviewDecision({ blocker, dependent: t.id, outcome: "accepted", note: "Imported claim" })));
    const record = new DependencyReview({ sourceVersion: version, taskIds: ["a", "b"], basis: "Imported claim", exceptions: [], reviewedAt: "2026-10-02", reviewer: "Example", decisions });
    expect(service.state(record, version, current)).toBe("exceptions");
    expect(service.knownExceptions(current).length).toBeGreaterThan(0);
  }
});

test("viewer uncertainty is derived from task facts instead of embedded derived metadata", async () => {
  // oracle: editing serialized states/findings cannot erase captured canceled, missing, unknown, or cyclic obligations.
  const { rec } = await import("../src/adapters/linear/GraphqlJson.ts");
  const cases = [[task.with({ status: "canceled" }), consumer], [task, consumer.with({ blockedBy: ["missing"] })],
    [task.with({ status: "unknown" }), consumer], [task.with({ blockedBy: ["b"] }), consumer]];
  for (const tasks of cases) {
    const a = analyzer.analyse(tasks, "synthetic");
    const version = await identity.identify(a);
    const record = new DependencyReview({ sourceVersion: version, taskIds: ["a", "b"], basis: "Imported assertion", exceptions: [], reviewer: "Example", reviewedAt: "2026-10-02",
      decisions: tasks.flatMap(t => t.blockedBy.map(blocker => new ReviewDecision({ blocker, dependent: t.id, outcome: "accepted", note: "Imported assertion" }))) });
    const data = rec(JSON.parse(new ViewerData().render(analyzer.analyse(tasks, "synthetic", { review: record }))));
    const snapshot = rec(data["snapshot"]); snapshot["findings"] = [];
    const rows = snapshot["tasks"];
    if (!Array.isArray(rows)) { throw new Error("Invalid fixture tasks"); }
    rows.forEach((row: unknown) => { rec(row)["state"] = "blocked"; });
    const decoded = await new ViewerDataCodec().decode(JSON.stringify(data));
    expect(await identity.identify(decoded.analysis)).toBe(version);
    expect(service.state(decoded.analysis.review, version, decoded.analysis)).toBe("exceptions");
  }
});

test("combined recorded and candidate decision overflow gives a capacity recovery message", () => {
  const decisions = Array.from({ length: 20001 }, (_, i) => new ReviewDecision({ blocker: String(i), dependent: "consumer", outcome: "unreviewed", note: "" }));
  expect(() => new DependencyReview({ sourceVersion: "a".repeat(64), taskIds: ["consumer"], basis: "Read captured requirements", exceptions: [],
    reviewedAt: "2026-10-02", reviewer: "Example", decisions })).toThrow("review: maximum combined recorded and candidate decisions is 20000; use a smaller capture");
});

test("one review service scans immutable capture text once across coverage disclosures", async () => {
  const record = review(await identity.identify(original));
  const coverage = new DependencyReviewService();
  const scan = spyOn(DependencyDiscoveryService.prototype, "scan");
  try {
    coverage.state(record, record.sourceVersion, original);
    coverage.knownExceptions(original);
    coverage.outsideDecisions(record, original);
    coverage.candidateExceptions(record, original);
    coverage.completedCandidateRejections(record, original);
    coverage.missingDecisions(record, original);
    expect(scan).toHaveBeenCalledTimes(1);
    const changed = analyzer.analyse([task, consumer.with({ description: "New requirements" })], "synthetic");
    coverage.knownExceptions(changed);
    expect(scan).toHaveBeenCalledTimes(2);
  } finally { scan.mockRestore(); }
});
