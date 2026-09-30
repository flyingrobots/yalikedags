import { describe, expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import type { TaskFields } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";

const t = (id: string, blockedBy: string[] = [], extra: Partial<TaskFields> = {}): Task =>
  new Task({ id, title: id, blockedBy, ...extra });

describe("Task invariants", () => {
  test("a task cannot block itself", () => {
    expect(() => t("a", ["a"])).toThrow(/cannot block itself/);
  });
  test("a task cannot be its own parent or child", () => {
    expect(() => new Task({ id: "a", title: "a", parent: "a" })).toThrow(/own parent/);
    expect(() => new Task({ id: "a", title: "a", children: ["a"] })).toThrow(/own child/);
  });
  test("effort preserves finite nonnegative source values", () => {
    expect(t("a", [], { effort: 8 }).effort).toBe(8);
    expect(() => t("a", [], { effort: -1 })).toThrow(/effort/);
    expect(() => t("a", [], { effort: Infinity })).toThrow(/effort/);
    expect(t("a", [], { effort: 1.5 }).effort).toBe(1.5);
    expect(t("a", [], { effort: 0 }).effort).toBe(0);
  });
  test("done and canceled both count as done; open and in-progress do not", () => {
    expect(t("a", [], { status: "done" }).isDone()).toBe(true);
    expect(t("a", [], { status: "canceled" }).isDone()).toBe(true);
    expect(t("a", [], { status: "in-progress" }).isDone()).toBe(false);
    expect(t("a").isDone()).toBe(false);
  });
  test("duplicate blockers collapse and the task is frozen", () => {
    const task = t("a", ["b", "b"]);
    expect(task.blockedBy).toEqual(["b"]);
    expect(Object.isFrozen(task)).toBe(true);
  });
});

describe("Dag", () => {
  test("refuses duplicate ids", () => {
    expect(() => new Dag([t("a"), t("a")])).toThrow(/duplicate/);
  });
  test("derives dependents as the inverse of blockedBy and ignores dangling refs", () => {
    const dag = new Dag([t("a"), t("b", ["a", "ghost"])]);
    expect(dag.dependents("a")).toEqual(["b"]);
    expect(dag.blockers("b")).toEqual(["a"]);
    expect(dag.validate().dangling).toEqual([{ task: "b", ref: "ghost" }]);
  });
  test("finds cycles and names every member", () => {
    const dag = new Dag([t("a", ["c"]), t("b", ["a"]), t("c", ["b"]), t("d")]);
    const { cycles } = dag.validate();
    expect(cycles).toHaveLength(1);
    expect([...cycles[0]!].sort()).toEqual(["a", "b", "c"]);
  });
  test("reports transitively redundant edges", () => {
    const dag = new Dag([t("a"), t("b", ["a"]), t("c", ["a", "b"])]);
    expect(dag.validate().redundant).toEqual([{ from: "c", to: "a", via: "b" }]);
  });
  test("topological order puts blockers first", () => {
    const dag = new Dag([t("c", ["b"]), t("b", ["a"]), t("a")]);
    expect(dag.topologicalOrder()).toEqual(["a", "b", "c"]);
  });
  test("topological order throws on a cycle", () => {
    const dag = new Dag([t("a", ["b"]), t("b", ["a"])]);
    expect(() => dag.topologicalOrder()).toThrow(/cycle/);
  });
  test("descendants and ancestors are transitive closures", () => {
    const dag = new Dag([t("a"), t("b", ["a"]), t("c", ["b"]), t("x")]);
    expect([...dag.descendants("a")].sort()).toEqual(["b", "c"]);
    expect([...dag.ancestors("c")].sort()).toEqual(["a", "b"]);
    expect(dag.descendants("x").size).toBe(0);
  });
});
