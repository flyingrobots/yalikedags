import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { JsonSnapshotAdapter } from "../src/adapters/output/JsonSnapshotAdapter.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const analyzer = new AnalysisService(new FixedClockAdapter("2026-10-02"));
const task = (id: string, blockedBy: string[] = []): Task => new Task({ id, title: id, blockedBy });
const diamond = [task("a"), task("b", ["a"]), task("c", ["a"]), task("d", ["b", "c"])];

test("diamond grouping carries explicit coverage rather than a deliverable claim", () => {
  // oracle: A is shared; B, C, D form one topological component despite parallel B/C branches.
  const a = analyzer.analyse(diamond, "synthetic");
  const json = new JsonSnapshotAdapter().toObject(a);
  expect(json).toHaveProperty("planning.schema", "yalikedags/planning/1");
  expect(json).toHaveProperty("planning.shared", ["a"]);
  expect(json).toHaveProperty("planning.workstreams", [{ id: "b", tasks: ["b", "c", "d"] }]);
  expect(json).toHaveProperty("planning.exceptions", []);
  expect(json).toHaveProperty("planning.included", ["a", "b", "c", "d"]);
  expect(json).toHaveProperty("planning.grouping", "connected components after removing shared prerequisites; temporary analysis, not ownership or deliverables");
});

test("unschedulable obligations have one explicit exception category", () => {
  // oracle: unresolved work must not also be counted in a workstream or shared category.
  const a = analyzer.analyse([new Task({ id: "canceled", title: "Canceled", status: "canceled" }), task("consumer", ["canceled"]), task("next", ["consumer"]), task("free")], "synthetic");
  expect(a.workstreams.map(stream => stream.tasks)).toEqual([["free"]]);
  const json = new JsonSnapshotAdapter().toObject(a);
  expect(json).toHaveProperty("planning.exceptions", ["consumer", "next"]);
  expect(json).toHaveProperty("planning.excluded", ["canceled"]);
  expect(json).toHaveProperty("planning.shared", []);
});

test("graph evidence is deterministic and changes with task state", () => {
  // oracle: input ordering is irrelevant, but completing the smallest stream member changes the graph coordinate and grouping.
  const first = new JsonSnapshotAdapter().toObject(analyzer.analyse(diamond, "synthetic"));
  const reordered = new JsonSnapshotAdapter().toObject(analyzer.analyse([...diamond].reverse(), "synthetic"));
  expect(first["planning"]).toEqual(reordered["planning"]);
  const changed = analyzer.analyse(diamond.map(t => t.id === "b" ? t.with({ status: "done" }) : t), "synthetic");
  expect(new JsonSnapshotAdapter().toObject(changed)["planning"]).not.toEqual(first["planning"]);
});

test("invalid proposed partitions are rejected at the planning boundary", async () => {
  // oracle: omitted tasks, duplicate ownership, and same-wave prerequisites cannot masquerade as a valid plan.
  const { PlanningCoverage } = await import("../src/core/services/PlanningCoverage.ts");
  const { Workstream } = await import("../src/core/services/WavesService.ts");
  const a = analyzer.analyse([task("a"), task("b", ["a"])], "synthetic");
  const valid = { dag: a.dag, waves: a.waves, shared: a.gatekeepers, workstreams: a.workstreams };
  expect(() => new PlanningCoverage({ ...valid, waves: [["a", "b"]] })).toThrow("prerequisite order");
  expect(() => new PlanningCoverage({ ...valid, waves: [["a"]] })).toThrow("omitted schedulable work");
  expect(() => new PlanningCoverage({ ...valid, workstreams: [] })).toThrow("group coverage");
  expect(() => new PlanningCoverage({ ...valid, workstreams: [new Workstream("a", ["a", "b"]), new Workstream("b", ["b"])] })).toThrow("duplicate");
});

test("cycles and disconnected work retain explicit coverage without invented ownership", () => {
  // oracle: a cycle is an exception, while independent acyclic tasks have separate analytical groups.
  const a = analyzer.analyse([task("a", ["b"]), task("b", ["a"]), task("c", ["b"]), task("free"), task("other")], "synthetic");
  expect(a.planning.exceptions).toEqual(["a", "b", "c"]);
  expect(a.planning.workstreams.map(stream => stream.tasks)).toEqual([["free"], ["other"]]);
  expect(a.planning.included).toEqual(["a", "b", "c", "free", "other"]);
});


test("refresh changes analytical membership without durable ownership", () => {
  // oracle: completing/removing the smallest member changes identity; removing a gatekeeper leaves independent branches.
  const chain = [task("a"), task("b", ["a"]), task("c", ["b"])];
  expect(analyzer.analyse(chain, "synthetic").workstreams[0]?.id).toBe("a");
  expect(analyzer.analyse(chain.map(t => t.id === "a" ? t.with({ status: "done" }) : t), "synthetic").workstreams[0]?.id).toBe("b");
  expect(analyzer.analyse([task("b"), task("c", ["b"])], "synthetic").workstreams[0]?.id).toBe("b");
  const fork = [task("a"), task("b", ["a"]), task("c", ["a"])];
  expect(analyzer.analyse(fork, "synthetic").planning.shared).toEqual(["a"]);
  expect(analyzer.analyse([task("b"), task("c")], "synthetic").workstreams.map(s => s.tasks)).toEqual([["b"], ["c"]]);
  expect(analyzer.analyse([task("b"), task("c", ["b"])], "synthetic").workstreams.map(s => s.tasks)).toEqual([["b", "c"]]);
});

test("completed outputs end active prerequisite paths", () => {
  // oracle: a completed intermediate output already exists, so its consumer need not wait for historical upstream work.
  const a = analyzer.analyse([task("a"), task("b", ["a"]).with({ status: "done" }), task("c", ["b"])], "synthetic");
  expect(a.waves).toEqual([["a", "c"]]);
  expect(a.planning.excluded).toEqual(["b"]);
});
