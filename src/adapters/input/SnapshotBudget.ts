import { rec } from "../linear/GraphqlJson.ts";

/** Input budgets are enforced before Task/Dag construction, including ignored JSON fields. */
export class SnapshotBudget {
  static readonly bytes = 8 * 1024 * 1024;
  static readonly tasks = 5000;
  static readonly edges = 20000;
  static readonly stringLength = 65536;

  parse(text: string): unknown {
    if (text.length > SnapshotBudget.bytes || new TextEncoder().encode(text).length > SnapshotBudget.bytes) { this.fail("maximum file size is 8 MiB"); }
    const value: unknown = JSON.parse(text);
    const tasks = rec(value)["tasks"];
    if (Array.isArray(tasks)) {
      if (tasks.length > SnapshotBudget.tasks) { this.fail("maximum task count is 5000"); }
      const edges = tasks.reduce<number>((sum, task: unknown) => {
        const blockers = rec(task)["blockedBy"]; return sum + (Array.isArray(blockers) ? blockers.length : 0);
      }, 0);
      if (edges > SnapshotBudget.edges) { this.fail("maximum blocker reference count is 20000"); }
    }
    this.inspect(value);
    return value;
  }

  private inspect(raw: unknown): void {
    const stack = [{ value: raw, depth: 0 }];
    let nodes = 0;
    while (stack.length > 0) {
      const entry = stack.pop();
      if (entry === undefined) { break; }
      if (++nodes > 100000 || entry.depth > 32) { this.fail("maximum structure is 100000 values and 32 nesting levels"); }
      if (typeof entry.value === "string" && entry.value.length > SnapshotBudget.stringLength) { this.fail("maximum string length is 65536 characters"); }
      if (entry.value === null || typeof entry.value !== "object") { continue; }
      const values: unknown[] = Object.values(entry.value);
      if (values.length + stack.length + nodes > 100000) { this.fail("maximum structure is 100000 values"); }
      values.forEach((value) => stack.push({ value, depth: entry.depth + 1 }));
    }
  }
  private fail(reason: string): never { throw new Error(`snapshot_limit: ${reason}`); }
}
