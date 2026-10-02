import { Task } from "../../src/core/domain/Task.ts";
/** Synthetic sparse planning backlog, deliberately unrelated to any real tracker. */
export function sparseBacklog(extra = false): Task[] {
  return Array.from({ length: extra ? 253 : 250 }, (_, i) => new Task({
    id: `sample-${String(i)}`, key: `EX-${String(i)}`, title: `Synthetic work ${String(i)}`,
    status: i >= 225 && i < 250 ? "done" : "open",
    labels: i >= 200 && i < 210 ? ["type:container"] : [i % 9 === 0 ? "type:research" : "type:feature"],
    blockedBy: i > 0 && i < 20 ? [`sample-${String(i - 1)}`] : i >= 25 && i < 55 ? [`sample-${String(20 + i % 5)}`] : [],
  }));
}
