import { test, expect } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { LayeredLayoutService } from "../src/core/services/LayeredLayoutService.ts";

test("sparse backlog packing preserves identities and edges with compact nonoverlapping cards", () => {
  const tasks = Array.from({ length: 250 }, (_, i) => new Task({ id: `task-${String(i)}`, title: `Task ${String(i)}`,
    status: i >= 230 ? "done" : "open", blockedBy: i > 0 && i < 20 ? [`task-${String(i - 1)}`] : i >= 25 && i < 55 ? [`task-${String(20 + i % 5)}`] : [] }));
  const dag = new Dag(tasks); const before = tasks.map(t => [...t.blockedBy]);
  const layout = new LayeredLayoutService().layout(dag);
  expect(new Set(layout.nodes.map(node => node.id)).size).toBe(250);
  expect(layout.nodes).toHaveLength(250);
  expect(new Set(layout.nodes.map(node => `${String(node.layer)},${String(node.row)}`)).size).toBe(250);
  // Oracle: a packed backlog must not leave hundreds of roots in one tall column.
  expect(layout.maxRows).toBeLessThan(45);
  expect(layout.layerCount).toBeLessThanOrEqual(25);
  expect(tasks.map(t => [...t.blockedBy])).toEqual(before);
  for (const task of tasks) { for (const blocker of task.blockedBy) {
    expect(layout.position(blocker)?.layer).toBeLessThan(layout.position(task.id)?.layer ?? 0);
  } }
});
