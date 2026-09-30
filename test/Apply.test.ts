import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { AddBlockingRelation, RemoveBlockingRelation, SetEstimate, SetMilestone } from "../src/core/domain/Mutation.ts";
import { Plan } from "../src/core/domain/Plan.ts";
import { ApplyService } from "../src/core/services/ApplyService.ts";
import { DryRunTaskWriterAdapter } from "../src/adapters/output/DryRunTaskWriterAdapter.ts";
import type { TaskWriterPort } from "../src/ports/TaskWriterPort.ts";

const t = (id: string, blockedBy: string[] = [], extra = {}): Task => new Task({ id, title: id, blockedBy, ...extra });

const planOf = (mutations: ConstructorParameters<typeof Plan>[0]["mutations"]): Plan =>
  new Plan({ mutations, unmatched: [], desiredSource: "dag:p.json", currentSource: "linear:Example", createdAt: "2026-09-23", labels: {} });

/** A writer that refuses everything, to exercise the failed outcome. */
class RefusingWriter implements TaskWriterPort {
  describe(): string {
    return "refusing";
  }
  addBlockingRelation(): Promise<void> {
    return Promise.reject(new Error("linear_write_refused: nope"));
  }
  removeBlockingRelation(): Promise<void> {
    return Promise.reject(new Error("linear_write_refused: nope"));
  }
  setEstimate(): Promise<void> {
    return Promise.reject(new Error("linear_write_refused: nope"));
  }
  setMilestone(): Promise<void> {
    return Promise.reject(new Error("linear_write_refused: nope"));
  }
}

describe("Mutation.satisfiedBy", () => {
  // oracle: specified. A mutation is satisfied when a graph shows its effect, and not otherwise.
  test("an add is satisfied only once the edge is present", () => {
    const m = new AddBlockingRelation("a", "b");
    expect(m.satisfiedBy(new Dag([t("a"), t("b")]))).toBe(false);
    expect(m.satisfiedBy(new Dag([t("a"), t("b", ["a"])]))).toBe(true);
  });

  test("a remove is satisfied only once the edge is gone", () => {
    const m = new RemoveBlockingRelation("a", "b");
    expect(m.satisfiedBy(new Dag([t("a"), t("b", ["a"])]))).toBe(false);
    expect(m.satisfiedBy(new Dag([t("a"), t("b")]))).toBe(true);
  });

  test("a field mutation is satisfied when the value matches, including a cleared one", () => {
    expect(new SetEstimate("a", 2, null).satisfiedBy(new Dag([t("a", [], { effort: 2 })]))).toBe(true);
    expect(new SetEstimate("a", null, 2).satisfiedBy(new Dag([t("a")]))).toBe(true);
    expect(new SetMilestone("a", "M", null).satisfiedBy(new Dag([t("a", [], { milestone: "M" })]))).toBe(true);
    expect(new SetMilestone("a", "M", null).satisfiedBy(new Dag([t("a")]))).toBe(false);
  });

  test("a mutation about a task the graph does not contain is never satisfied", () => {
    expect(new AddBlockingRelation("a", "gone").satisfiedBy(new Dag([t("a")]))).toBe(false);
    expect(new SetEstimate("gone", 1, null).satisfiedBy(new Dag([t("a")]))).toBe(false);
  });
});

describe("Mutation.preconditionHolds", () => {
  // oracle: specified. The precondition is the state the plan was written against.
  test("a field mutation's precondition is the value the plan recorded as `from`", () => {
    const m = new SetEstimate("a", 2, null);
    expect(m.preconditionHolds(new Dag([t("a")]))).toBe(true);
    expect(m.preconditionHolds(new Dag([t("a", [], { effort: 1 })]))).toBe(false);
    expect(new SetMilestone("a", "M2", "M1").preconditionHolds(new Dag([t("a", [], { milestone: "M1" })]))).toBe(true);
    expect(new SetMilestone("a", "M2", "M1").preconditionHolds(new Dag([t("a", [], { milestone: "other" })]))).toBe(false);
  });

  test("an edge mutation needs only its endpoints, because it assumes no prior value", () => {
    expect(new AddBlockingRelation("a", "b").preconditionHolds(new Dag([t("a"), t("b")]))).toBe(true);
    expect(new AddBlockingRelation("a", "b").preconditionHolds(new Dag([t("b")]))).toBe(false);
    expect(new RemoveBlockingRelation("a", "b").preconditionHolds(new Dag([t("a")]))).toBe(false);
  });
});

describe("Mutation.projectEdges", () => {
  // oracle: specified. Only blockedBy is projected, because only blockedBy can close a cycle.
  test("an add and a remove change the blocked task's edges and nothing else", () => {
    const b = t("b", ["a"]);
    expect(new AddBlockingRelation("c", "b").projectEdges(b).blockedBy).toEqual(["a", "c"]);
    expect(new RemoveBlockingRelation("a", "b").projectEdges(b).blockedBy).toEqual([]);
    expect(new AddBlockingRelation("c", "other").projectEdges(b)).toBe(b);
  });

  test("a field mutation returns the task untouched", () => {
    const a = t("a");
    expect(new SetEstimate("a", 2, null).projectEdges(a)).toBe(a);
    expect(new SetMilestone("a", "M", null).projectEdges(a)).toBe(a);
  });
});

describe("ApplyService", () => {
  // oracle: specified. A write is confirmed only by a fresh read that shows it.
  test("a write that the re-read shows is confirmed", async () => {
    const plan = planOf([new AddBlockingRelation("a", "b")]);
    const after = new Dag([t("a"), t("b", ["a"])]);
    const receipt = await new ApplyService().apply({
      plan,
      writer: new DryRunTaskWriterAdapter("target"),
      before: new Dag([t("a"), t("b")]),
      reread: () => Promise.resolve(after),
      at: "2026-09-23",
    });
    expect(receipt.count("confirmed")).toBe(1);
    expect(receipt.complete).toBe(true);
  });

  test("a write that returns cleanly but does not show in the re-read stays unconfirmed", async () => {
    const plan = planOf([new AddBlockingRelation("a", "b")]);
    const unchanged = new Dag([t("a"), t("b")]);
    const receipt = await new ApplyService().apply({
      plan,
      writer: new DryRunTaskWriterAdapter("target"),
      before: unchanged,
      reread: () => Promise.resolve(unchanged),
      at: "2026-09-23",
    });
    expect(receipt.count("unconfirmed")).toBe(1);
    expect(receipt.complete).toBe(false);
    expect(receipt.results[0]!.detail).toMatch(/fresh read does not show it/);
  });

  test("a refused write is failed and carries the refusal, and does not stop the rest", async () => {
    const plan = planOf([new AddBlockingRelation("a", "b"), new SetEstimate("a", 1, null)]);
    const receipt = await new ApplyService().apply({
      plan,
      writer: new RefusingWriter(),
      before: new Dag([t("a"), t("b")]),
      reread: () => Promise.resolve(new Dag([t("a"), t("b")])),
      at: "2026-09-23",
    });
    expect(receipt.count("failed")).toBe(2);
    expect(receipt.results[0]!.detail).toMatch(/linear_write_refused/);
  });

  test("destructive mutations are skipped by default and performed only when allowed", async () => {
    const plan = planOf([new RemoveBlockingRelation("a", "b")]);
    const before = new Dag([t("a"), t("b", ["a"])]);
    const after = new Dag([t("a"), t("b")]);
    const guarded = new DryRunTaskWriterAdapter("target");
    const skipped = await new ApplyService().apply({ plan, writer: guarded, before, reread: () => Promise.resolve(before), at: "x" });
    expect(skipped.count("skipped")).toBe(1);
    expect(guarded.writes).toEqual([]);

    const allowed = new DryRunTaskWriterAdapter("target");
    const done = await new ApplyService().apply({ plan, writer: allowed, before, reread: () => Promise.resolve(after), refuseDestructive: false, at: "x" });
    expect(done.count("confirmed")).toBe(1);
    expect(allowed.writes).toEqual([{ method: "removeBlockingRelation", args: ["a", "b"] }]);
  });

  test("a skipped plan is incomplete: the reviewed changes have not all landed", async () => {
    const before = new Dag([t("a"), t("b", ["a"])]);
    const receipt = await new ApplyService().apply({
      plan: planOf([new RemoveBlockingRelation("a", "b")]),
      writer: new DryRunTaskWriterAdapter("target"),
      before,
      reread: () => Promise.resolve(before),
      at: "x",
    });
    expect(receipt.complete).toBe(false);
  });

  test("when the source cannot be read back, the receipt is unverified and never complete", async () => {
    const receipt = await new ApplyService().apply({
      plan: planOf([new AddBlockingRelation("a", "b")]),
      writer: new DryRunTaskWriterAdapter("target"),
      before: new Dag([t("a"), t("b")]),
      reread: () => Promise.reject(new Error("linear_http_error: HTTP 500")),
      at: "x",
    });
    expect(receipt.verified).toBe(false);
    expect(receipt.complete).toBe(false);
    expect(receipt.count("unconfirmed")).toBe(1);
  });

  test("mutations are written in the plan's own order", async () => {
    const writer = new DryRunTaskWriterAdapter("target");
    await new ApplyService().apply({
      plan: planOf([new AddBlockingRelation("a", "b"), new SetEstimate("c", 2, null), new SetMilestone("d", "M", null)]),
      writer,
      before: new Dag([t("a"), t("b"), t("c"), t("d")]),
      reread: () => Promise.resolve(new Dag([t("a")])),
      at: "x",
    });
    expect(writer.writes.map((w) => w.method)).toEqual(["addBlockingRelation", "setEstimate", "setMilestone"]);
  });
});

/**
 * The gate that makes `destructive` mean something at the moment it is used.
 * A plan's verdict about what it would destroy is made when the plan is
 * written; these say what happens when the source moves in between.
 */
describe("ApplyService and a source that moved since the plan was made", () => {
  // oracle: specified. A mutation whose recorded `from` no longer holds is stale, not written.
  test("a field mutation is stale, unwritten, and leaves the plan incomplete when its `from` has moved", async () => {
    const writer = new DryRunTaskWriterAdapter("target");
    const moved = new Dag([t("a", [], { effort: 3 })]);
    const receipt = await new ApplyService().apply({
      plan: planOf([new SetEstimate("a", 2, null)]),
      writer,
      before: moved,
      reread: () => Promise.resolve(moved),
      at: "x",
    });
    expect(receipt.count("stale")).toBe(1);
    expect(writer.writes).toEqual([]);
    expect(receipt.complete).toBe(false);
    expect(receipt.results[0]!.detail).toMatch(/re-plan/);
  });

  test("allowing destructive writes does not also allow stale ones: the two gates are separate", async () => {
    const writer = new DryRunTaskWriterAdapter("target");
    const moved = new Dag([t("a", [], { effort: 3 })]);
    const receipt = await new ApplyService().apply({
      plan: planOf([new SetEstimate("a", 2, 1)]),
      writer,
      before: moved,
      reread: () => Promise.resolve(moved),
      refuseDestructive: false,
      at: "x",
    });
    expect(receipt.count("stale")).toBe(1);
    expect(writer.writes).toEqual([]);
  });

  test("a mutation about a task that has since vanished is stale rather than a failed write", async () => {
    const writer = new DryRunTaskWriterAdapter("target");
    const gone = new Dag([t("a")]);
    const receipt = await new ApplyService().apply({
      plan: planOf([new AddBlockingRelation("a", "b")]),
      writer,
      before: gone,
      reread: () => Promise.resolve(gone),
      at: "x",
    });
    expect(receipt.count("stale")).toBe(1);
    expect(writer.writes).toEqual([]);
  });

  // oracle: specified. Re-running a half-applied plan must stay free, which is what orders the checks.
  test("a mutation that already landed is confirmed without writing, not called stale", async () => {
    const writer = new DryRunTaskWriterAdapter("target");
    const landed = new Dag([t("a", [], { effort: 2 }), t("b", ["a"])]);
    const receipt = await new ApplyService().apply({
      plan: planOf([new SetEstimate("a", 2, null), new AddBlockingRelation("a", "b")]),
      writer,
      before: landed,
      reread: () => Promise.resolve(landed),
      at: "x",
    });
    expect(receipt.count("confirmed")).toBe(2);
    expect(receipt.count("stale")).toBe(0);
    expect(writer.writes).toEqual([]);
    expect(receipt.complete).toBe(true);
    expect(receipt.results[0]!.detail).toMatch(/already in place/);
  });
});
