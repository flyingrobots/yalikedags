import { Task } from "../../core/domain/Task.ts";
import type { Priority, TaskFields } from "../../core/domain/Task.ts";
import { ResourcePolicy } from "../../core/domain/ResourcePolicy.ts";
import type { ResourceMode, ResourceRule } from "../../core/domain/ResourcePolicy.ts";
import type { TaskRepositoryPort } from "../../ports/TaskRepositoryPort.ts";

/**
 * The task-dag JSON schema: a stored-minimum plan file.
 *
 * Only two facts per node are authoritative (`done` and `blocked_by`); the
 * rest are attributes. It is the same shape used by the planning engines this
 * layout came from, which is why it reads a node's `id` as both identity and
 * human key: in practice those ids are the tracker's own identifiers, and
 * that is what makes reconciliation against a tracker possible at all.
 *
 * ```json
 * { "nodes": [ { "id": "PRO-1", "title": "...", "done": false,
 *                "blocked_by": ["PRO-0"], "pri": 2, "resources": ["deep-work"] } ],
 *   "resources": [ { "id": "deep-work", "mode": "exclusive" } ] }
 * ```
 */
const MODES: readonly ResourceMode[] = ["exclusive", "capacity", "advisory"];
const PRIORITIES: readonly Priority[] = [1, 2, 3, 4];

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x);
const strOf = (x: unknown): string | undefined => (typeof x === "string" ? x : undefined);
const strList = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);

export interface TaskDagOptions {
  /** Map each node's `group` onto the task's milestone. Off by default: it turns a local label into a tracker write. */
  groupsAsMilestones?: boolean;
}

export class TaskDagJsonRepositoryAdapter implements TaskRepositoryPort {
  constructor(
    private readonly text: string,
    private readonly name: string,
    private readonly options: TaskDagOptions = {},
  ) {}

  describe(): string {
    return `task-dag ${this.name}`;
  }

  load(): Promise<readonly Task[]> {
    try {
      return Promise.resolve(this.nodes().map((n) => this.toTask(n)));
    } catch (error: unknown) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Resource modes declared in the file, for the frontier's conflict report. */
  policy(): ResourcePolicy {
    const raw: unknown = JSON.parse(this.text);
    const declared = isRec(raw) && Array.isArray(raw["resources"]) ? raw["resources"] : [];
    const rules: ResourceRule[] = [];
    for (const entry of declared) {
      if (!isRec(entry)) {
        continue;
      }
      const id = strOf(entry["id"]);
      const mode = MODES.find((m) => m === entry["mode"]);
      if (id !== undefined && mode !== undefined) {
        const capacity = typeof entry["capacity"] === "number" ? entry["capacity"] : undefined;
        rules.push({ id, mode, ...(capacity !== undefined && { capacity }) });
      }
    }
    return new ResourcePolicy(rules);
  }

  private nodes(): Rec[] {
    const raw: unknown = JSON.parse(this.text);
    if (!isRec(raw) || !Array.isArray(raw["nodes"])) {
      throw new Error(`task-dag: ${this.name} has no nodes array`);
    }
    return raw["nodes"].filter(isRec);
  }

  private toTask(n: Rec): Task {
    const id = strOf(n["id"]);
    if (id === undefined) {
      throw new Error(`task-dag: ${this.name} has a node with no id`);
    }
    const f: TaskFields = {
      id,
      key: id,
      title: strOf(n["title"]) ?? id,
      status: n["done"] === true ? "done" : "open",
      blockedBy: strList(n["blocked_by"]),
      resources: strList(n["resources"]),
    };
    const group = strOf(n["group"]);
    const due = strOf(n["due"]);
    const priority = PRIORITIES.find((p) => p === n["pri"]);
    const effort = typeof n["effort"] === "number" ? n["effort"] : undefined;
    return new Task({
      ...f,
      ...(group !== undefined && (this.options.groupsAsMilestones === true ? { milestone: group } : { labels: [group] })),
      ...(due !== undefined && { due }),
      ...(priority !== undefined && { priority }),
      ...(effort !== undefined && { effort }),
    });
  }
}
