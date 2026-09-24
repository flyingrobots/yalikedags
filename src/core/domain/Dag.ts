/**
 * Dag: tasks plus the `blockedBy` edges between them, with the derived
 * views that fall out of those two facts. Pure data structure, no I/O.
 */
import type { Task } from "./Task.ts";

export interface DanglingRef {
  task: string;
  ref: string;
}

export interface RedundantEdge {
  from: string;
  to: string;
  via: string;
}

export interface Validation {
  cycles: string[][];
  dangling: DanglingRef[];
  redundant: RedundantEdge[];
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`internal: missing ${what}`);
  }
  return value;
}

export class Dag {
  private readonly byId = new Map<string, Task>();
  private readonly dependentsOf = new Map<string, string[]>();

  constructor(tasks: Iterable<Task>) {
    for (const task of tasks) {
      if (this.byId.has(task.id)) {
        throw new Error(`duplicate task id: ${task.id}`);
      }
      this.byId.set(task.id, task);
      this.dependentsOf.set(task.id, []);
    }
    for (const task of this.byId.values()) {
      for (const b of task.blockedBy) {
        this.dependentsOf.get(b)?.push(task.id);
      }
    }
  }

  get size(): number {
    return this.byId.size;
  }

  get tasks(): Task[] {
    return [...this.byId.values()];
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): Task {
    const t = this.byId.get(id);
    if (!t) {
      throw new Error(`unknown task: ${id}`);
    }
    return t;
  }

  /** Blockers of `id` that exist in this graph (dangling refs are dropped). */
  blockers(id: string): string[] {
    return this.get(id).blockedBy.filter((b) => this.byId.has(b));
  }

  /** Derived inverse edge: tasks whose `blockedBy` names `id`. */
  dependents(id: string): string[] {
    return [...(this.dependentsOf.get(id) ?? [])];
  }

  descendants(id: string): Set<string> {
    return this.closure(id, (x) => this.dependents(x));
  }

  ancestors(id: string): Set<string> {
    return this.closure(id, (x) => this.blockers(x));
  }

  private closure(start: string, next: (id: string) => string[]): Set<string> {
    const seen = new Set<string>();
    const stack = next(start);
    while (stack.length > 0) {
      const cur = must(stack.pop(), "stack top");
      if (!seen.has(cur)) {
        seen.add(cur);
        stack.push(...next(cur));
      }
    }
    return seen;
  }

  /** Kahn's algorithm. Throws if the graph has a cycle. */
  topologicalOrder(): string[] {
    const indeg = new Map<string, number>();
    for (const id of this.byId.keys()) {
      indeg.set(id, this.blockers(id).length);
    }
    const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id).sort();
    const out: string[] = [];
    while (queue.length > 0) {
      const id = must(queue.shift(), "queue head");
      out.push(id);
      for (const dep of this.dependents(id).sort()) {
        const d = (indeg.get(dep) ?? 0) - 1;
        indeg.set(dep, d);
        if (d === 0) {
          queue.push(dep);
        }
      }
    }
    if (out.length !== this.byId.size) {
      throw new Error("graph has a cycle; run validate() to see it");
    }
    return out;
  }

  validate(): Validation {
    return { cycles: this.findCycles(), dangling: this.findDangling(), redundant: this.findRedundant() };
  }

  private findDangling(): DanglingRef[] {
    const out: DanglingRef[] = [];
    for (const task of this.byId.values()) {
      for (const ref of task.blockedBy) {
        if (!this.byId.has(ref)) {
          out.push({ task: task.id, ref });
        }
      }
    }
    return out;
  }

  /** Every strongly connected component with more than one member, via Tarjan. */
  private findCycles(): string[][] {
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const out: string[][] = [];
    let counter = 0;
    const strong = (v: string): void => {
      index.set(v, counter);
      low.set(v, counter);
      counter += 1;
      stack.push(v);
      onStack.add(v);
      for (const w of this.blockers(v)) {
        if (!index.has(w)) {
          strong(w);
          low.set(v, Math.min(must(low.get(v), "low v"), must(low.get(w), "low w")));
        } else if (onStack.has(w)) {
          low.set(v, Math.min(must(low.get(v), "low v"), must(index.get(w), "index w")));
        }
      }
      if (low.get(v) === index.get(v)) {
        const comp: string[] = [];
        let w: string;
        do {
          w = must(stack.pop(), "scc stack");
          onStack.delete(w);
          comp.push(w);
        } while (w !== v);
        if (comp.length > 1) {
          out.push(comp);
        }
      }
    };
    for (const id of this.byId.keys()) {
      if (!index.has(id)) {
        strong(id);
      }
    }
    return out;
  }

  /** An edge a->c is redundant when some other blocker b of a already has c as an ancestor. */
  private findRedundant(): RedundantEdge[] {
    const out: RedundantEdge[] = [];
    for (const task of this.byId.values()) {
      const bs = this.blockers(task.id);
      for (const to of bs) {
        const via = bs.find((b) => b !== to && this.ancestors(b).has(to));
        if (via !== undefined) {
          out.push({ from: task.id, to, via });
        }
      }
    }
    return out;
  }
}
