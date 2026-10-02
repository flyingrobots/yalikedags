import { test, expect } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { DependencyImpact } from "../src/core/services/DependencyImpact.ts";

test("impact separates tasks made ready from descendants with other blockers and excludes closed work", () => {
  const dag = new Dag([
    new Task({ id: "a", title: "A" }), new Task({ id: "other", title: "Other" }),
    new Task({ id: "direct", title: "Direct", blockedBy: ["a"] }),
    new Task({ id: "shared", title: "Shared", blockedBy: ["a", "other"] }),
    new Task({ id: "later", title: "Later", blockedBy: ["direct"] }),
    new Task({ id: "closed", title: "Closed", blockedBy: ["a"], status: "done" }),
    new Task({ id: "missing", title: "Missing", blockedBy: ["a", "external"] }),
  ]);
  const impact = new DependencyImpact();
  expect(impact.immediate(dag, "a")).toEqual(["direct"]);
  expect(impact.downstream(dag, "a").sort()).toEqual(["direct", "later", "missing", "shared"]);
  expect(impact.immediate(dag, "later")).toEqual([]);
});
