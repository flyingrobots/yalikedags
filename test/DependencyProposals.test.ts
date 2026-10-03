import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { LinearAccount } from "../src/core/domain/LinearAccount.ts";
import { DependencyReview } from "../src/core/domain/DependencyReview.ts";
import { ReviewDecision } from "../src/core/domain/ReviewDecision.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { DependencyDiscoveryService } from "../src/core/services/DependencyDiscoveryService.ts";
import { DependencyProposalService } from "../src/core/services/DependencyProposalService.ts";
import { ReviewIdentityAdapter } from "../src/adapters/review/ReviewIdentityAdapter.ts";
import { DependencyReviewService } from "../src/core/services/DependencyReviewService.ts";
import { ApplyService } from "../src/core/services/ApplyService.ts";
import { PlanJsonCodec } from "../src/adapters/plan/PlanJsonCodec.ts";
import { InMemoryTaskWriterAdapter } from "./fakes/InMemoryTaskWriterAdapter.ts";
import { Dag } from "../src/core/domain/Dag.ts";

const tasks = [new Task({ id: "a", key: "DEMO-1", title: "Schema" }), new Task({ id: "b", key: "DEMO-2", title: "Consumer", description: "Requires DEMO-1 output before merge." }), new Task({ id: "c", key: "DEMO-3", title: "Independent docs" })];
const analyzer = new AnalysisService({ today: (): string => "2026-10-02" });
const account = new LinearAccount({ id: "user", name: "Fixture" }, { id: "workspace", name: "Fixture" }, { id: "project", name: "Fixture" });
const analysis = analyzer.analyse(tasks, "synthetic", { account });
const accepted = new ReviewDecision({ blocker: "a", dependent: "b", outcome: "accepted", note: "Consumer requires the schema produced by DEMO-1." });

async function review(decisions: readonly ReviewDecision[] = [accepted]): Promise<DependencyReview> {
  return new DependencyReview({ sourceVersion: await new ReviewIdentityAdapter().identify(analysis), taskIds: tasks.map(t => t.id), basis: "Read schema requirement", reviewer: "Fixture reviewer", reviewedAt: "2026-10-02T00:00:00Z", exceptions: [], decisions });
}

test("description evidence changes only a selected proposal graph", () => {
  // oracle: explicit output requirement creates A → B; unrelated C stays independent and source has no edge.
  const candidates = new DependencyDiscoveryService().discover(analysis.dag);
  expect(candidates).toHaveLength(1);
  expect(candidates[0]).toMatchObject({ blocker: "a", dependent: "b", confidence: "explicit", evidence: "Requires DEMO-1 output before merge." });
  const preview = new DependencyProposalService().preview(analysis, [accepted], "accepted");
  expect(preview.waves).toEqual([["a", "c"], ["b"]]);
  expect(analysis.waves).toEqual([["a", "b", "c"]]);
  expect(new DependencyProposalService().preview(analysis, [], "accepted").waves).toEqual(analysis.waves);
});

test("weak, negated, and reverse references stay uncertain and rejected candidates stay out", () => {
  // oracle: mentioning a key is insufficient evidence for a directed prerequisite.
  for (const description of ["Related to DEMO-1", "Does not require DEMO-1", "This blocks DEMO-1"]) {
    const a = analyzer.analyse(tasks.map(t => t.id === "b" ? t.with({ description }) : t), "synthetic");
    expect(new DependencyDiscoveryService().discover(a.dag)[0]?.confidence).toBe("uncertain");
    const reject = new ReviewDecision({ blocker: "a", dependent: "b", outcome: "rejected", note: "Not a prerequisite" });
    expect(new DependencyProposalService().preview(a, [reject], "proposed").waves).toEqual(a.waves);
  }
});

test("accepted review produces a version-guarded relation-only plan and a verified receipt", async () => {
  // oracle: one accepted edge leads to one independently verified addition, leaving the source capture intact.
  const record = await review();
  expect(new DependencyReviewService().state(record, record.sourceVersion, analysis)).toBe("reviewed");
  const plan = new PlanJsonCodec().decode(new PlanJsonCodec().encode(new DependencyProposalService().plan(analysis, record, record.sourceVersion)));
  expect(plan.prerequisiteVersion).toBe(record.sourceVersion);
  expect(plan.mutations.map(m => m.kind)).toEqual(["add-blocking-relation"]);
  const writer = new InMemoryTaskWriterAdapter(tasks);
  const receipt = await new ApplyService().apply({ plan, writer, before: analysis.dag, reread: () => Promise.resolve(new Dag(writer.tasks)), at: "fixture" });
  expect(receipt.complete).toBe(true);
  expect(analysis.dag.blockers("b")).toEqual([]);
});

test("stale evidence and cyclic accepted proposals refuse plan export", async () => {
  // oracle: a reviewed quote cannot authorize changed source content or a cyclic relation set.
  const record = await review();
  expect(() => new DependencyProposalService().plan(analysis, record, "f".repeat(64))).toThrow("stale");
  const cyclic = analyzer.analyse(tasks.map(t => t.id === "a" ? t.with({ blockedBy: ["b"] }) : t), "synthetic", { account });
  const hash = await new ReviewIdentityAdapter().identify(cyclic);
  const cyclicReview = new DependencyReview({ ...{ sourceVersion: hash, taskIds: tasks.map(t => t.id), basis: "Fixture", reviewer: "Fixture", reviewedAt: "2026-10-02", exceptions: [] }, decisions: [accepted] });
  expect(() => new DependencyProposalService().plan(cyclic, cyclicReview, hash)).toThrow("plan_would_cycle");
});

test("CLI refuses changed proposal evidence before obtaining a writer", async () => {
  // oracle: changing a cited description after plan review must stop the explicit apply path before any write.
  const { ReconcileCommands } = await import("../src/cli/ReconcileCommands.ts");
  const { SourceResolver } = await import("../src/cli/SourceResolver.ts");
  const { Args } = await import("../src/cli/Args.ts");
  const { EnvSecretsAdapter } = await import("../src/adapters/secrets/EnvSecretsAdapter.ts");
  const { RecordingHttpAdapter } = await import("./fakes/RecordingHttpAdapter.ts");
  const { JsonSnapshotAdapter } = await import("../src/adapters/output/JsonSnapshotAdapter.ts");
  const { Plan } = await import("../src/core/domain/Plan.ts");
  const record = await review();
  const original = new DependencyProposalService().plan(analysis, record, record.sourceVersion);
  const plan = new Plan({ mutations: original.mutations, unmatched: [], labels: original.labels, desiredSource: original.desiredSource,
    currentSource: "snapshot:current.json", createdAt: original.createdAt, prerequisiteVersion: original.prerequisiteVersion });
  const changed = analyzer.analyse(tasks.map(t => t.id === "b" ? t.with({ description: "Now independent" }) : t), "synthetic", { account });
  const http = new RecordingHttpAdapter([]);
  let source = new JsonSnapshotAdapter().render(changed);
  const commands = new ReconcileCommands({ resolver: new SourceResolver({ http, secrets: new EnvSecretsAdapter({}),
    readFile: (path: string): Promise<string> => Promise.resolve(path === "plan.json" ? new PlanJsonCodec().encode(plan) : source) }), clock: { today: (): string => "2026-10-02" },
    io: { out: (): void => undefined, err: (): void => undefined, writeFile: (): Promise<void> => Promise.resolve() } });
  const refusal = await commands.apply(new Args(["apply", "--plan", "plan.json", "--confirm"])).then(() => "unexpected success", (error: unknown) => error instanceof Error ? error.message : "unexpected error");
  expect(refusal).toContain("stale_proposal");
  source = new JsonSnapshotAdapter().render(analysis);
  expect(await commands.apply(new Args(["apply", "--plan", "plan.json"]))).toBe(0);
  expect(http.requests).toHaveLength(0);
});

test("proposal receipts retain failed verification and ambiguous write outcomes", async () => {
  // oracle: accepting a proposal cannot turn an ignored write or failed verification read into success.
  const { DryRunTaskWriterAdapter } = await import("../src/adapters/output/DryRunTaskWriterAdapter.ts");
  const record = await review();
  const plan = new DependencyProposalService().plan(analysis, record, record.sourceVersion);
  const writer = new DryRunTaskWriterAdapter("ignored writes");
  const ignored = await new ApplyService().apply({ plan, writer, before: analysis.dag, reread: () => Promise.resolve(analysis.dag), at: "fixture" });
  expect(ignored.complete).toBe(false);
  expect(ignored.count("unconfirmed")).toBe(1);
  const failed = await new ApplyService().apply({ plan, writer, before: analysis.dag, reread: () => Promise.reject(new Error("unavailable")), at: "fixture" });
  expect(failed.verified).toBe(false);
  expect(failed.complete).toBe(false);
});

test("imported same-hash incomplete scope cannot export an accepted plan", async () => {
  // oracle: the review lifecycle's stale scope must also block the plan-export boundary.
  const version = await new ReviewIdentityAdapter().identify(analysis);
  const partial = new DependencyReview({ sourceVersion: version, taskIds: ["b"], basis: "Imported partial claim", exceptions: [], reviewer: "Fixture", reviewedAt: "2026-10-02", decisions: [accepted] });
  expect(new DependencyReviewService().state(partial, version, analysis)).toBe("stale");
  expect(() => new DependencyProposalService().plan(analysis, partial, version)).toThrow("stale");
});

test("imported accepted candidate requires an evidence and direction rationale", async () => {
  // oracle: importing a claim cannot bypass the human evidence required by candidate acceptance.
  const empty = new ReviewDecision({ blocker: "a", dependent: "b", outcome: "accepted", note: "" });
  const record = await review([empty]);
  expect(new DependencyReviewService().state(record, record.sourceVersion, analysis)).toBe("exceptions");
  expect(() => new DependencyProposalService().plan(analysis, record, record.sourceVersion)).toThrow("rationale");
});

test("review coverage includes missing candidates without calling accepted candidates extraneous", async () => {
  // oracle: integrating review coverage with discovery preserves both the missing-decision disclosure and candidate ownership.
  const service = new DependencyReviewService();
  expect(service.missingDecisions(await review([]), analysis)).toMatchObject([{ blocker: "a", dependent: "b", outcome: "unreviewed" }]);
  expect(service.missingDecisions(await review(), analysis)).toEqual([]);
  expect(service.outsideDecisions(await review(), analysis)).toEqual([]);
});

test("bounded discovery is invariant to capture task order", async () => {
  // oracle: canonical source identity must select the same candidates when input ordering alone changes at the ceiling.
  const many = Array.from({ length: 46 }, (_, i) => new Task({ id: `task-${String(i)}`, key: `DEMO-${String(i)}`, title: "Example", description: Array.from({ length: 46 }, (_entry, j) => `Requires DEMO-${String(j)}.`).join("\n") }));
  const first = analyzer.analyse(many, "synthetic");
  const reversed = analyzer.analyse([...many].reverse(), "synthetic");
  expect(await new ReviewIdentityAdapter().identify(first)).toBe(await new ReviewIdentityAdapter().identify(reversed));
  const discover = new DependencyDiscoveryService();
  const candidates = discover.discover(first.dag);
  expect(candidates).toHaveLength(2000);
  expect(new DependencyReviewService().knownExceptions(first)).toContain("Candidate discovery omitted additional pairs beyond its 2,000-result limit; review coverage is incomplete.");
  expect(discover.discover(reversed.dag).map(c => [c.blocker, c.dependent])).toEqual(candidates.map(c => [c.blocker, c.dependent]));
});

test("candidate excerpts retain the reference within the documented length limit", () => {
  // oracle: truncation markers count toward the excerpt bound without removing the cited issue key.
  const long = analyzer.analyse([new Task({ id: "a", key: "DEMO-1", title: "Schema" }), new Task({ id: "b", title: "Consumer", description: `${"x".repeat(500)} Requires DEMO-1 ${"y".repeat(1000)}` })], "synthetic");
  const candidate = new DependencyDiscoveryService().discover(long.dag)[0];
  expect(candidate?.evidence).toContain("DEMO-1");
  expect(candidate?.evidence.length).toBeLessThanOrEqual(1024);
});

test("negated contractions, questions, and word suffixes never claim explicit prerequisite evidence", () => {
  // Oracle: these sentences mention a key but do not affirm a prerequisite.
  for (const description of ["Doesn't require DEMO-1", "Doesn’t require DEMO-1", "Cannot require DEMO-1", "Can't require DEMO-1", "Would this require DEMO-1?", "Requires DEMO-1?", "Prerequires DEMO-1"]) {
    const capture = analyzer.analyse(tasks.map(t => t.id === "b" ? t.with({ description }) : t), "synthetic");
    expect(new DependencyDiscoveryService().discover(capture.dag)[0]).toMatchObject({ evidence: description, confidence: "uncertain" });
  }
});

test("an exact candidate ceiling is complete and retained evidence can improve after the ceiling", () => {
  const blockers = Array.from({ length: 2000 }, (_, i) => new Task({ id: `b-${String(i)}`, key: `DEMO-${String(i)}`, title: "Output" }));
  const description = `${blockers.map(t => `Related to ${t.key}.`).join("\n")}\nRequires DEMO-0.`;
  const capture = analyzer.analyse([...blockers, new Task({ id: "zz-consumer", title: "Consumer", description })], "synthetic");
  expect(new DependencyReviewService().knownExceptions(capture)).toEqual([]);
  const candidates = new DependencyDiscoveryService().discover(capture.dag);
  expect(candidates).toHaveLength(2000);
  expect(candidates.find(c => c.blocker === "b-0")).toMatchObject({ confidence: "explicit", evidence: "Requires DEMO-0." });
});

test("hedged, conditional, historical, and unpunctuated questions remain uncertain", () => {
  for (const description of ["This may need DEMO-1.", "It might depend on DEMO-1", "Could require DEMO-1", "Should require DEMO-1", "Used to require DEMO-1", "Requires DEMO-1 if the flag is on", "Requires DEMO-1 unless replaced", "Requires DEMO-1 once enabled", "Neither requires DEMO-1", "Nor requires DEMO-1", "Does this require DEMO-1"]) {
    const capture = analyzer.analyse(tasks.map(t => t.id === "b" ? t.with({ description }) : t), "synthetic");
    expect(new DependencyDiscoveryService().discover(capture.dag)[0]?.confidence).toBe("uncertain");
  }
});

test("mutually proposed prerequisites remain visible as cyclic hypothetical coverage", () => {
  const capture = analyzer.analyse([new Task({ id: "a", key: "DEMO-1", title: "A", description: "Requires DEMO-2." }),
    new Task({ id: "b", key: "DEMO-2", title: "B", description: "Requires DEMO-1." })], "synthetic");
  const preview = new DependencyProposalService().preview(capture, [], "proposed");
  expect(preview.dag.validate().cycles.length).toBeGreaterThan(0);
  expect(preview.waves).toEqual([]);
  expect(preview.frontier).toEqual([]);
  expect(preview.findings.some(f => f.kind === "cycle")).toBe(true);
  expect(capture.waves).toEqual([["a", "b"]]);
});

test("candidate excerpt markers identify only sides where text was omitted", () => {
  for (const description of [`DEMO-1 ${"x".repeat(2000)}`, `${"x".repeat(2000)} DEMO-1`]) {
    const capture = analyzer.analyse(tasks.map(t => t.id === "b" ? t.with({ description }) : t), "synthetic");
    const evidence = new DependencyDiscoveryService().discover(capture.dag)[0]?.evidence ?? "";
    expect(evidence.startsWith("…")).toBe(!description.startsWith("DEMO-1"));
    expect(evidence.endsWith("…")).toBe(!description.endsWith("DEMO-1"));
    expect(evidence).toContain("DEMO-1");
    expect(evidence.length).toBeLessThanOrEqual(1024);
  }
});
