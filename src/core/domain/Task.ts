/**
 * Task: the one entity in the domain. A node in the dependency graph.
 *
 * Only two facts are ever authoritative for scheduling: `blockedBy` and
 * `status`. Everything else (ready, blocked, frontier, workstream) is a fold
 * over those facts computed at read time. Nothing derived is stored here.
 *
 * Task is a class because it has invariants (TypeScript standard, Rule 3).
 * It validates in the constructor and freezes itself.
 */

export type TaskStatus = "open" | "in-progress" | "done" | "canceled" | "unknown";

/** Priority follows Linear: 1 urgent, 2 high, 3 medium, 4 low. Absent means unset. */
export type Priority = 1 | 2 | 3 | 4;

export interface TaskFields {
  /** Stable identity (a Linear issue id, or a slug for file-based sources). */
  id: string;
  title: string;
  /** Human key shown in the UI (`PRO-123`). Defaults to `id`. */
  key?: string;
  status?: TaskStatus;
  /** Ids of tasks that must be done before this one can start. The only stored edge. */
  blockedBy?: readonly string[];
  parent?: string;
  children?: readonly string[];
  priority?: Priority;
  /** Exact source estimate, a finite nonnegative number. Absent means unestimated. */
  effort?: number;
  assignee?: string;
  assigneeId?: string;
  labels?: readonly string[];
  milestone?: string;
  /** ISO date, YYYY-MM-DD. */
  due?: string;
  /** Names of contended resources this task occupies while in progress. */
  resources?: readonly string[];
  url?: string;
  /** ISO date-time of creation, used only for age ordering. */
  createdAt?: string;
  description?: string;
}

const unique = (xs: readonly string[] | undefined): readonly string[] => Object.freeze([...new Set(xs ?? [])]);

export class Task {
  readonly id: string;
  readonly key: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly blockedBy: readonly string[];
  readonly parent: string | undefined;
  readonly children: readonly string[];
  readonly priority: Priority | undefined;
  readonly effort: number | undefined;
  readonly assignee: string | undefined;
  readonly assigneeId: string | undefined;
  readonly labels: readonly string[];
  readonly milestone: string | undefined;
  readonly due: string | undefined;
  readonly resources: readonly string[];
  readonly url: string | undefined;
  readonly createdAt: string | undefined;
  readonly description: string | undefined;

  constructor(fields: TaskFields) {
    Task.checkInvariants(fields);
    this.id = fields.id;
    this.key = fields.key ?? fields.id;
    this.title = fields.title;
    this.status = fields.status ?? "open";
    this.blockedBy = unique(fields.blockedBy);
    this.parent = fields.parent;
    this.children = unique(fields.children);
    this.priority = fields.priority;
    this.effort = fields.effort;
    this.assignee = fields.assignee;
    this.assigneeId = fields.assigneeId;
    this.labels = unique(fields.labels);
    this.milestone = fields.milestone;
    this.due = fields.due;
    this.resources = unique(fields.resources);
    this.url = fields.url;
    this.createdAt = fields.createdAt;
    this.description = fields.description;
    Object.freeze(this);
  }

  private static checkInvariants(f: TaskFields): void {
    if (f.blockedBy?.includes(f.id)) {
      throw new Error(`Task ${f.id} cannot block itself`);
    }
    if (f.parent === f.id) {
      throw new Error(`Task ${f.id} cannot be its own parent`);
    }
    if (f.children?.includes(f.id)) {
      throw new Error(`Task ${f.id} cannot be its own child`);
    }
    if (f.effort !== undefined && (!Number.isFinite(f.effort) || f.effort < 0)) {
      throw new Error(`Task ${f.id}: effort must be a finite nonnegative number, got ${String(f.effort)}`);
    }
  }

  /** Done for scheduling purposes: the task can no longer block anything. */
  isDone(): boolean {
    return this.status === "done" || this.status === "canceled";
  }

  isInProgress(): boolean {
    return this.status === "in-progress";
  }

  /** Effort as Linear counts it: an unestimated task weighs 1. */
  weight(): number {
    return this.effort ?? 1;
  }

  /** A copy with some fields replaced. Tasks are immutable; this is how they change. */
  with(changes: Partial<TaskFields>): Task {
    return new Task({ ...this.toFields(), ...changes });
  }

  private assignmentFields(): Partial<TaskFields> {
    return this.assigneeId === undefined ? {} : { assigneeId: this.assigneeId };
  }

  /** The plain fields, for adapters that need to serialize. The class itself never does. */
  toFields(): TaskFields {
    const out: TaskFields = {
      id: this.id,
      title: this.title,
      key: this.key,
      status: this.status,
      blockedBy: [...this.blockedBy],
      children: [...this.children],
      labels: [...this.labels],
      resources: [...this.resources],
    };
    if (this.parent !== undefined) { out.parent = this.parent; }
    if (this.priority !== undefined) { out.priority = this.priority; }
    if (this.effort !== undefined) { out.effort = this.effort; }
    Object.assign(out, this.assignmentFields());
    if (this.assignee !== undefined) { out.assignee = this.assignee; }
    if (this.milestone !== undefined) { out.milestone = this.milestone; }
    if (this.due !== undefined) { out.due = this.due; }
    if (this.url !== undefined) { out.url = this.url; }
    if (this.createdAt !== undefined) { out.createdAt = this.createdAt; }
    if (this.description !== undefined) { out.description = this.description; }
    return out;
  }
}
