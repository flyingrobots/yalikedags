import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import type { TaskFields } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { StateService } from "../src/core/services/StateService.ts";
import { FrontierService } from "../src/core/services/FrontierService.ts";
import { ResourcePolicy } from "../src/core/domain/ResourcePolicy.ts";
import { WavesService } from "../src/core/services/WavesService.ts";
import { CriticalPathService } from "../src/core/services/CriticalPathService.ts";
import { AuditService } from "../src/core/services/AuditService.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const t = (id: string, blockedBy: string[] = [], extra: Partial<TaskFields> = {}): Task =>
  new Task({ id, title: id, blockedBy, ...extra });
const done = (id: string, blockedBy: string[] = []): Task => t(id, blockedBy, { status: "done" });
const clock = new FixedClockAdapter("2026-09-23");

describe("StateService", () => {
  // oracle: specified. ready = open with every blocker done; blocked otherwise; done and in-progress pass through.
  test("a task is ready only when every blocker is done", () => {
    const dag = new Dag([done("a"), t("b", ["a"]), t("c", ["b"]), t("d", ["a"], { status: "in-progress" })]);
    const s = new StateService();
    expect(s.stateOf(dag, "a")).toBe("done");
    expect(s.stateOf(dag, "b")).toBe("ready");
    expect(s.stateOf(dag, "c")).toBe("blocked");
    expect(s.stateOf(dag, "d")).toBe("in-progress");
  });
  test("a dangling blocker leaves readiness unresolved", () => {
    const dag = new Dag([t("b", ["ghost"])]);
    expect(new StateService().stateOf(dag, "b")).toBe("unresolved");
  });
});

describe("FrontierService", () => {
  // oracle: specified, ported from dag.py: sort by (days until due, priority, -fanout, createdAt, id).
  test("the frontier is the ready set ordered by urgency, then priority, then fan-out, then id", () => {
    const dag = new Dag([
      t("late", [], { due: "2026-09-20", priority: 4 }),
      t("urgent", [], { priority: 1 }),
      t("wide", []),
      t("w1", ["wide"]),
      t("w2", ["wide"]),
      t("narrow", []),
      t("blocked", ["narrow"]),
      done("gone"),
    ]);
    const ids = new FrontierService(clock).frontier(dag).map((e) => e.task.id);
    expect(ids).toEqual(["late", "urgent", "wide", "narrow"]);
  });
  test("each frontier entry reports its urgency and how many tasks it transitively unblocks", () => {
    const dag = new Dag([t("a", [], { due: "2026-09-25" }), t("b", ["a"]), t("c", ["b"])]);
    const [entry] = new FrontierService(clock).frontier(dag);
    expect(entry!.daysUntilDue).toBe(2);
    expect(entry!.downstreamImpact).toBe(2);
  });
  test("undated tasks sort after dated ones", () => {
    const dag = new Dag([t("undated"), t("dated", [], { due: "2027-01-01" })]);
    const ids = new FrontierService(clock).frontier(dag).map((e) => e.task.id);
    expect(ids).toEqual(["dated", "undated"]);
  });
  test("ready tasks sharing an exclusive resource are reported as conflicting", () => {
    const dag = new Dag([t("a", [], { resources: ["db"] }), t("b", [], { resources: ["db"] }), t("c", [], { resources: ["db"] })]);
    const policy = new ResourcePolicy([{ id: "db", mode: "exclusive" }]);
    const conflicts = new FrontierService(clock).resourceConflicts(dag, policy);
    expect(conflicts.get("a")).toEqual(["db (exclusive, 3 ready contenders, 0 in-progress holders)"]);
    expect(conflicts.size).toBe(3);
  });
  test("a capacity resource conflicts only above its capacity, and advisory never does", () => {
    const dag = new Dag([t("a", [], { resources: ["gpu", "eyes"] }), t("b", [], { resources: ["gpu", "eyes"] })]);
    const policy = new ResourcePolicy([{ id: "gpu", mode: "capacity", capacity: 2 }, { id: "eyes", mode: "advisory" }]);
    expect(new FrontierService(clock).resourceConflicts(dag, policy).size).toBe(0);
  });
});

describe("WavesService", () => {
  // oracle: specified. Waves are Kahn layers over open tasks; each wave is an antichain.
  test("waves layer open tasks so that no task shares a wave with its blocker", () => {
    const dag = new Dag([done("z"), t("a", ["z"]), t("b", ["a"]), t("c", ["a"]), t("d", ["b", "c"]), t("e")]);
    const waves = new WavesService().waves(dag).map((w) => [...w].sort());
    expect(waves).toEqual([["a", "e"], ["b", "c"], ["d"]]);
  });
  test("a gatekeeper is an open task with two or more open dependents", () => {
    const dag = new Dag([t("gate"), t("x", ["gate"]), t("y", ["gate"]), t("solo"), t("s2", ["solo"])]);
    expect(new WavesService().gatekeepers(dag)).toEqual(["gate"]);
  });
  test("workstreams are the connected pieces of the open graph once gatekeepers are cut out", () => {
    const dag = new Dag([
      t("gate"),
      t("x1", ["gate"]), t("x2", ["x1"]),
      t("y1", ["gate"]), t("y2", ["y1"]),
      t("island"),
      done("old"), t("z", ["old"]),
    ]);
    const streams = new WavesService().workstreams(dag).map((s) => [...s.tasks].sort());
    expect(streams).toEqual([["island"], ["x1", "x2"], ["y1", "y2"], ["z"]]);
  });
  test("workstreams are mutually exclusive and collectively exhaustive over open non-gatekeeper tasks", () => {
    const dag = new Dag([t("g"), t("a", ["g"]), t("b", ["g"]), t("c", ["a", "b"])]);
    const service = new WavesService();
    const covered = service.workstreams(dag).flatMap((s) => s.tasks);
    const gates = service.gatekeepers(dag);
    expect(new Set(covered).size).toBe(covered.length);
    expect([...covered, ...gates].sort()).toEqual(["a", "b", "c", "g"]);
  });
});

describe("CriticalPathService", () => {
  // oracle: specified, ported from dag.py for depth; effort weighting is this repo's addition.
  test("the critical path by depth is the longest chain of open tasks, blockers first", () => {
    const dag = new Dag([done("z"), t("a", ["z"]), t("b", ["a"]), t("c", ["b"]), t("x"), t("y", ["x"])]);
    const path = new CriticalPathService().byDepth(dag);
    expect(path.tasks).toEqual(["a", "b", "c"]);
    expect(path.length).toBe(3);
  });
  test("the critical path by effort weighs unestimated tasks as 1 and can differ from depth", () => {
    const dag = new Dag([t("a"), t("b", ["a"]), t("c", ["b"]), t("heavy", [], { effort: 3 }), t("heavy2", ["heavy"], { effort: 3 })]);
    const svc = new CriticalPathService();
    expect(svc.byDepth(dag).tasks).toEqual(["a", "b", "c"]);
    expect(svc.byEffort(dag).tasks).toEqual(["heavy", "heavy2"]);
    expect(svc.byEffort(dag).length).toBe(6);
  });
  test("with nothing open both paths are empty", () => {
    const dag = new Dag([done("a")]);
    expect(new CriticalPathService().byDepth(dag).tasks).toEqual([]);
  });
});

describe("AuditService", () => {
  // oracle: specified by the brief the tool was built from: isolated, redundant, stale-blocker, split candidates.
  test("an open task with no edges in either direction is reported as isolated", () => {
    const dag = new Dag([t("a"), t("b", ["a"]), t("alone")]);
    const kinds = new AuditService().audit(dag).filter((f) => f.task === "alone").map((f) => f.kind);
    expect(kinds).toEqual(["isolated"]);
  });
  test("a transitively redundant edge is reported with the path that makes it redundant", () => {
    const dag = new Dag([t("a"), t("b", ["a"]), t("c", ["a", "b"])]);
    const f = new AuditService().audit(dag).find((x) => x.kind === "redundant-edge");
    expect(f?.task).toBe("c");
    expect(f?.detail).toContain("via b");
  });
  test("an edge to a completed task is reported as stale", () => {
    const dag = new Dag([done("old"), t("a", ["old"]), t("b", ["a"])]);
    const stale = new AuditService().audit(dag).filter((x) => x.kind === "stale-blocker");
    expect(stale.map((x) => x.task)).toEqual(["a"]);
  });
  test("split candidates use structural evidence, not an assumed estimate scale", () => {
    const dag = new Dag([
      t("big", [], { effort: 3 }),
      t("two", [], { title: "Build the parser and write the docs" }),
      t("hub"), t("h1", ["hub"]), t("h2", ["hub"]), t("h3", ["hub"]), t("h4", ["hub"]),
    ]);
    const split = new AuditService().audit(dag).filter((x) => x.kind === "split-candidate");
    expect(split.map((x) => x.task).sort()).toEqual(["hub", "two"]);
    for (const f of split) {
      expect(f.detail.length).toBeGreaterThan(0);
      expect(f.wouldKill.length).toBeGreaterThan(0);
    }
  });
  test("a cycle is reported once with every member named", () => {
    const dag = new Dag([t("a", ["b"]), t("b", ["a"])]);
    const cycles = new AuditService().audit(dag).filter((x) => x.kind === "cycle");
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.detail).toContain("a");
    expect(cycles[0]!.detail).toContain("b");
  });
});
