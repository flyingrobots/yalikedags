import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import type { TaskFields } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { ReconcileService } from "../src/core/services/ReconcileService.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const clock = new FixedClockAdapter("2026-09-23");
const service = new ReconcileService(clock);

const t = (id: string, blockedBy: string[] = [], extra: Partial<TaskFields> = {}): Task =>
  new Task({ id, title: id, blockedBy, ...extra });

const plan = (desired: Task[], current: Task[], options = {}): ReturnType<ReconcileService["plan"]> =>
  service.plan(
    { desired: new Dag(desired), current: new Dag(current), desiredSource: "dag:plan.json", currentSource: "linear:Example" },
    options,
  );

describe("ReconcileService matching", () => {
  // oracle: specified. Counterparts are found by id, then by key, case-insensitively, and by nothing else.
  test("matches by id when the source holds the same id", () => {
    const p = plan([t("a"), t("b", ["a"])], [t("a"), t("b")]);
    expect(p.unmatched).toEqual([]);
    expect(p.mutations.map((m) => m.describe(p.label()))).toEqual(["b is blocked by a"]);
  });

  test("matches by key when ids differ, case-insensitively", () => {
    const desired = [t("pro-1", [], { key: "pro-1" }), t("pro-2", ["pro-1"], { key: "PRO-2" })];
    const current = [t("uuid-1", [], { key: "PRO-1" }), t("uuid-2", [], { key: "pro-2" })];
    const p = plan(desired, current);
    expect(p.unmatched).toEqual([]);
    expect(p.mutations).toHaveLength(1);
    expect(p.mutations[0]!.toJSON()).toMatchObject({ kind: "add-blocking-relation", blockerId: "uuid-1", blockedId: "uuid-2" });
  });

  test("never matches by title, and reports the unmatched task instead", () => {
    const p = plan([t("x", [], { key: "X", title: "Same title" })], [t("uuid", [], { key: "PRO-9", title: "Same title" })]);
    expect(p.mutations).toEqual([]);
    expect(p.unmatched).toHaveLength(1);
    expect(p.unmatched[0]!.reason).toMatch(/no task at the source has this id or key/);
  });

  test("two desired tasks cannot claim one source task; the second is reported, not written", () => {
    const desired = [t("first", [], { key: "PRO-1" }), t("second", [], { key: "pro-1" })];
    const p = plan(desired, [t("uuid", [], { key: "PRO-1" })]);
    expect(p.unmatched).toHaveLength(1);
    expect(p.unmatched[0]!.desiredId).toBe("second");
    expect(p.unmatched[0]!.reason).toMatch(/already matched/);
  });

  test("an edge is only proposed when both of its endpoints matched", () => {
    const p = plan([t("a"), t("ghost"), t("b", ["a", "ghost"])], [t("a"), t("b")]);
    expect(p.mutations.map((m) => m.toJSON())).toEqual([{ kind: "add-blocking-relation", blockerId: "a", blockedId: "b" }]);
  });
});

describe("ReconcileService edges", () => {
  // oracle: specified. An edge the source already holds produces no mutation; a missing one produces exactly one.
  test("an edge the source already has produces nothing", () => {
    const p = plan([t("a"), t("b", ["a"])], [t("a"), t("b", ["a"])]);
    expect(p.isEmpty).toBe(true);
  });

  test("removals are not proposed unless prune is asked for", () => {
    const p = plan([t("a"), t("b")], [t("a"), t("b", ["a"])]);
    expect(p.mutations).toEqual([]);
  });

  test("with prune, an edge the desired graph does not have is removed", () => {
    const p = plan([t("a"), t("b")], [t("a"), t("b", ["a"])], { prune: true });
    expect(p.mutations.map((m) => m.toJSON())).toEqual([{ kind: "remove-blocking-relation", blockerId: "a", blockedId: "b" }]);
    expect(p.destructive).toHaveLength(1);
  });

  test("prune never touches an edge whose endpoint the desired graph has never heard of", () => {
    const desired = [t("a"), t("b")];
    const current = [t("a"), t("b", ["a", "stranger"]), t("stranger")];
    const p = plan(desired, current, { prune: true });
    expect(p.mutations.map((m) => m.toJSON())).toEqual([{ kind: "remove-blocking-relation", blockerId: "a", blockedId: "b" }]);
  });
});

describe("ReconcileService fields", () => {
  // oracle: specified. Absence in the desired graph means "not specified", never "clear it".
  test("an estimate that differs is set, and one that matches is not", () => {
    const p = plan([t("a", [], { effort: 2 }), t("b", [], { effort: 1 })], [t("a", [], { effort: 3 }), t("b", [], { effort: 1 })]);
    expect(p.mutations.map((m) => m.toJSON())).toEqual([{ kind: "set-estimate", taskId: "a", from: 3, to: 2 }]);
  });

  test("a desired task with no estimate never clears the source's estimate", () => {
    const p = plan([t("a")], [t("a", [], { effort: 3 })]);
    expect(p.isEmpty).toBe(true);
  });

  test("replacing an existing estimate counts as destructive; setting a blank one does not", () => {
    const replacing = plan([t("a", [], { effort: 1 })], [t("a", [], { effort: 3 })]);
    const filling = plan([t("a", [], { effort: 1 })], [t("a")]);
    expect(replacing.destructive).toHaveLength(1);
    expect(filling.destructive).toHaveLength(0);
  });

  test("estimates and milestones can each be turned off", () => {
    const desired = [t("a", [], { effort: 1, milestone: "M" })];
    const current = [t("a")];
    expect(plan(desired, current).mutations).toHaveLength(2);
    expect(plan(desired, current, { estimates: false }).mutations.map((m) => m.kind)).toEqual(["set-milestone"]);
    expect(plan(desired, current, { milestones: false }).mutations.map((m) => m.kind)).toEqual(["set-estimate"]);
  });
});

describe("ReconcileService plan document", () => {
  test("the plan records both sources, the day it was made, and a label per source task", () => {
    const p = plan([t("a", [], { key: "PRO-1" })], [t("a", [], { key: "PRO-1" })]);
    expect(p.desiredSource).toBe("dag:plan.json");
    expect(p.currentSource).toBe("linear:Example");
    expect(p.createdAt).toBe("2026-09-23");
    expect(p.label()("a")).toBe("PRO-1");
  });

  test("the same inputs produce the same ordering", () => {
    const desired = [t("c", ["a"]), t("b", ["a"]), t("a", [], { effort: 2 })];
    const current = [t("a"), t("b"), t("c")];
    const first = plan(desired, current).mutations.map((m) => m.sortKey());
    const second = plan([...desired].reverse(), [...current].reverse()).mutations.map((m) => m.sortKey());
    expect(first).toEqual(second);
  });
});

/**
 * The cycle guard. Each of these plans is made of edges that are individually
 * fine; it is the set that does not schedule, and the source would accept
 * every one of those writes in turn.
 */
describe("ReconcileService cycle guard", () => {
  // oracle: specified. A plan whose result has a cycle the source did not have is refused.
  test("refuses a plan whose edges close a cycle, naming the cards by key", () => {
    const desired = [t("a", ["b"]), t("b", ["a"])];
    const current = [t("a", [], { key: "PRO-1" }), t("b", [], { key: "PRO-2" })];
    expect(() => plan(desired, current)).toThrow(/^plan_would_cycle/);
    expect(() => plan(desired, current)).toThrow(/PRO-1|PRO-2/);
  });

  test("refuses a cycle closed against an edge the source already holds, not only one wholly inside the plan", () => {
    const desired = [t("a", ["b"]), t("b")];
    const current = [t("a"), t("b", ["a"])];
    expect(() => plan(desired, current)).toThrow(/^plan_would_cycle/);
  });

  // oracle: specified. Only a cycle the plan introduces is this plan's problem.
  test("passes a plan over a source that already has a cycle, because that cycle is not its doing", () => {
    const current = [t("a", ["b"]), t("b", ["a"]), t("c")];
    const p = plan([t("c", [], { effort: 2 })], current);
    expect(p.mutations).toHaveLength(1);
  });

  test("passes a plan whose removals break a cycle the source has", () => {
    const current = [t("a", ["b"]), t("b", ["a"])];
    const p = plan([t("a"), t("b", ["a"])], current, { prune: true });
    expect(p.mutations.map((m) => m.kind)).toEqual(["remove-blocking-relation"]);
  });
});
