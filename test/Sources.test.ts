import { describe, expect, test } from "bun:test";
import { SourceSpec } from "../src/cli/SourceSpec.ts";
import { TaskDagJsonRepositoryAdapter } from "../src/adapters/input/TaskDagJsonRepositoryAdapter.ts";
import { rejection } from "./fakes/rejection.ts";

const DAG = JSON.stringify({
  updated: "2026-09-23",
  resources: [
    { id: "deep-work", mode: "exclusive" },
    { id: "review", mode: "capacity", capacity: 2 },
    { id: "eyes", mode: "advisory" },
    { id: "broken", mode: "not-a-mode" },
  ],
  nodes: [
    { id: "PRO-1", title: "First", done: true, group: "monitors", pri: 2, resources: ["deep-work"] },
    { id: "PRO-2", title: "Second", done: false, blocked_by: ["PRO-1"], due: "2026-10-01", effort: 2 },
    { id: "PRO-3", title: "Third", blocked_by: ["PRO-2", 7], pri: 99 },
  ],
});

describe("SourceSpec", () => {
  // oracle: specified. kind:value, split on the first colon, with a closed set of kinds.
  test("parses each kind and keeps colons in the value", () => {
    expect(SourceSpec.parse("dag:plan.json")).toMatchObject({ kind: "dag", value: "plan.json" });
    expect(SourceSpec.parse("linear:Growth: Q4")).toMatchObject({ kind: "linear", value: "Growth: Q4" });
    expect(SourceSpec.parse("tasklist:TODO.md").toString()).toBe("tasklist:TODO.md");
  });

  test("only a linear source needs a key", () => {
    expect(SourceSpec.parse("linear:X").needsKey).toBe(true);
    expect(SourceSpec.parse("dag:X").needsKey).toBe(false);
  });

  test("an unknown kind, a missing colon, or an empty value is a usage error", () => {
    expect(() => SourceSpec.parse("jira:PROJ")).toThrow(/usage/);
    expect(() => SourceSpec.parse("plan.json")).toThrow(/usage/);
    expect(() => SourceSpec.parse("dag:")).toThrow(/usage/);
  });
});

describe("TaskDagJsonRepositoryAdapter", () => {
  // oracle: specified by the task-dag schema: done and blocked_by are the stored facts, the rest are attributes.
  test("reads the stored facts and carries the id as the human key", async () => {
    const tasks = await new TaskDagJsonRepositoryAdapter(DAG, "plan.json").load();
    const by = new Map(tasks.map((t) => [t.id, t]));
    expect(tasks).toHaveLength(3);
    expect(by.get("PRO-1")).toMatchObject({ key: "PRO-1", status: "done", priority: 2, resources: ["deep-work"] });
    expect(by.get("PRO-2")).toMatchObject({ status: "open", blockedBy: ["PRO-1"], due: "2026-10-01", effort: 2 });
  });

  test("a group becomes a label, and becomes a milestone only when asked", async () => {
    const plain = await new TaskDagJsonRepositoryAdapter(DAG, "plan.json").load();
    const pushed = await new TaskDagJsonRepositoryAdapter(DAG, "plan.json", { groupsAsMilestones: true }).load();
    expect(plain[0]!.labels).toEqual(["monitors"]);
    expect(plain[0]!.milestone).toBeUndefined();
    expect(pushed[0]!.milestone).toBe("monitors");
    expect(pushed[0]!.labels).toEqual([]);
  });

  test("a non-string blocker and an out-of-range priority are dropped rather than guessed at", async () => {
    const tasks = await new TaskDagJsonRepositoryAdapter(DAG, "plan.json").load();
    const third = tasks.find((t) => t.id === "PRO-3");
    expect(third?.blockedBy).toEqual(["PRO-2"]);
    expect(third?.priority).toBeUndefined();
  });

  test("the resource policy comes from the file, and an unknown mode is ignored rather than invented", () => {
    const policy = new TaskDagJsonRepositoryAdapter(DAG, "plan.json").policy();
    expect(policy.conflict("deep-work", 2)).toMatch(/exclusive, 2 ready contenders/);
    expect(policy.conflict("review", 2)).toBeUndefined();
    expect(policy.conflict("review", 3)).toMatch(/capacity 2/);
    expect(policy.conflict("eyes", 9)).toBeUndefined();
    expect(policy.conflict("broken", 9)).toBeUndefined();
  });

  test("a file with no nodes array, or a node with no id, is refused by name", async () => {
    expect((await rejection(new TaskDagJsonRepositoryAdapter("{}", "bad.json").load())).message).toMatch(/no nodes array/);
    expect((await rejection(new TaskDagJsonRepositoryAdapter('{"nodes":[{"title":"x"}]}', "bad.json").load())).message).toMatch(/node with no id/);
  });

  test("describe names the file, so a plan says where its desired graph came from", () => {
    expect(new TaskDagJsonRepositoryAdapter(DAG, "plan.json").describe()).toBe("task-dag plan.json");
  });
});
