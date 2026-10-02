import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { SnapshotChangesService } from "../src/core/services/SnapshotChangesService.ts";

test("comparison reports assigned and unassigned ownership changes", () => {
  const before = new Dag([new Task({ id: "a", title: "Task", assignee: "Sam" })]);
  const after = new Dag([new Task({ id: "a", title: "Task", assignee: "Alex" })]);
  expect(new SnapshotChangesService().compare(before, after)).toContainEqual({ kind: "assignment", task: "a", key: "a", detail: "Sam → Alex" });
});
