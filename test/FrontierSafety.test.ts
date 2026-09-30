import { expect, test } from "bun:test";
import { Task } from "../src/core/domain/Task.ts";
import { Dag } from "../src/core/domain/Dag.ts";
import { FrontierService } from "../src/core/services/FrontierService.ts";
import { ResourcePolicy } from "../src/core/domain/ResourcePolicy.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

const task = (id: string, blockedBy: string[] = []): Task => new Task({ id, title: id, blockedBy });
test("resource holders in progress count against capacity for ready tasks", () => {
    const dag = new Dag([
      new Task({ id: "busy", title: "Busy", status: "in-progress", resources: ["gpu"] }),
      new Task({ id: "ready", title: "Ready", resources: ["gpu"] }),
    ]);
    const conflicts = new FrontierService(new FixedClockAdapter("2026-09-28")).resourceConflicts(dag, new ResourcePolicy([{ id: "gpu", mode: "exclusive" }]));
    expect(conflicts.get("ready")?.join()).toMatch(/in.progress/);
  });

test("immediate unblocking differs from downstream impact", () => {
    const dag = new Dag([task("a"), task("other"), task("b", ["a", "other"]), task("c", ["b"]), task("d", ["a"])]);
    const entry = new FrontierService(new FixedClockAdapter("2026-09-28")).frontier(dag).find((e) => e.task.id === "a");
    expect(entry?.immediatelyUnblocks).toBe(1);
    expect(entry?.downstreamImpact).toBe(3);
  });
