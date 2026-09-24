import type { TaskWriterPort } from "../../ports/TaskWriterPort.ts";

export interface RecordedWrite {
  method: "addBlockingRelation" | "removeBlockingRelation" | "setEstimate" | "setMilestone";
  args: readonly (string | number | null)[];
}

/**
 * A writer that writes nothing and remembers what it was asked to do.
 *
 * This is what `apply` uses without `--confirm`, so a dry run exercises the
 * real code path (the same plan, the same ordering, the same destructive
 * gate) and differs only in where the calls land. A dry run that took a
 * different path would be evidence about that path, not about the real one.
 */
export class DryRunTaskWriterAdapter implements TaskWriterPort {
  readonly writes: RecordedWrite[] = [];

  constructor(private readonly target: string) {}

  describe(): string {
    return `${this.target} (dry run, nothing written)`;
  }

  addBlockingRelation(blockerId: string, blockedId: string): Promise<void> {
    this.writes.push({ method: "addBlockingRelation", args: [blockerId, blockedId] });
    return Promise.resolve();
  }

  removeBlockingRelation(blockerId: string, blockedId: string): Promise<void> {
    this.writes.push({ method: "removeBlockingRelation", args: [blockerId, blockedId] });
    return Promise.resolve();
  }

  setEstimate(taskId: string, effort: number | null): Promise<void> {
    this.writes.push({ method: "setEstimate", args: [taskId, effort] });
    return Promise.resolve();
  }

  setMilestone(taskId: string, milestoneName: string | null): Promise<void> {
    this.writes.push({ method: "setMilestone", args: [taskId, milestoneName] });
    return Promise.resolve();
  }
}
