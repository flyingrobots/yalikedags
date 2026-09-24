/**
 * Mutation: one change to one task at the source.
 *
 * Behaviour lives on the instantiated class rather than in a switch over a
 * kind tag (TypeScript standard, Rule 3). Each subclass knows four things
 * about itself: how to describe itself to a human, how to ask a writer to
 * perform it, whether a graph already satisfies it, and how to serialize.
 *
 * `satisfiedBy` is what makes the apply path verifiable: after writing, the
 * source is read again and every mutation is asked whether it can see itself
 * in the result. A mutation that cannot is reported as unconfirmed rather
 * than assumed to have worked.
 */
import type { Dag } from "./Dag.ts";
import type { Task } from "./Task.ts";
import type { TaskWriterPort } from "../../ports/TaskWriterPort.ts";

export type MutationKind = "add-blocking-relation" | "remove-blocking-relation" | "set-estimate" | "set-milestone";

/** Renders an id as something a human recognises, usually its key. */
export type Label = (id: string) => string;

export abstract class Mutation {
  abstract readonly kind: MutationKind;

  /** True when performing this can destroy information a person entered. */
  abstract readonly destructive: boolean;

  /** Source-side ids this mutation touches. Used for ordering and for receipts. */
  abstract readonly touches: readonly string[];

  abstract describe(label: Label): string;

  abstract apply(writer: TaskWriterPort): Promise<void>;

  /** True when `current` already shows the effect of this mutation. */
  abstract satisfiedBy(current: Dag): boolean;

  /**
   * True when the state this mutation was planned against still holds.
   *
   * A plan decides what is destructive when it is made. Without this, that
   * verdict is frozen against a world that moves: plan while a card has no
   * estimate, a teammate sets one, and applying would clobber it as a
   * non-destructive write. Checking at apply time is what makes the
   * destructive gate mean something at the moment it is used rather than at
   * the moment it was written.
   */
  abstract preconditionHolds(current: Dag): boolean;

  /**
   * `task` as it would stand after this mutation, for edges only.
   *
   * This exists so a plan can be built into a graph and checked before anybody
   * performs it: two independently reasonable edges can close a cycle that
   * neither one contains, and a source that accepts each write in turn will
   * hold a graph that no longer schedules. Only `blockedBy` is projected,
   * because only `blockedBy` can close a cycle; an estimate or a milestone
   * returns the task untouched.
   */
  abstract projectEdges(task: Task): Task;

  abstract toJSON(): Record<string, unknown>;

  /** Stable ordering key, so two runs over the same inputs produce the same plan. */
  sortKey(): string {
    return `${this.kind}\u0000${this.touches.join("\u0000")}`;
  }
}

export class AddBlockingRelation extends Mutation {
  readonly kind = "add-blocking-relation";
  readonly destructive = false;

  constructor(
    readonly blockerId: string,
    readonly blockedId: string,
  ) {
    super();
    Object.freeze(this);
  }

  get touches(): readonly string[] {
    return [this.blockedId, this.blockerId];
  }

  describe(label: Label): string {
    return `${label(this.blockedId)} is blocked by ${label(this.blockerId)}`;
  }

  apply(writer: TaskWriterPort): Promise<void> {
    return writer.addBlockingRelation(this.blockerId, this.blockedId);
  }

  satisfiedBy(current: Dag): boolean {
    return current.has(this.blockedId) && current.blockers(this.blockedId).includes(this.blockerId);
  }

  /** Adding an edge destroys nothing, so no prior state is assumed beyond both ends existing. */
  preconditionHolds(current: Dag): boolean {
    return current.has(this.blockedId) && current.has(this.blockerId);
  }

  projectEdges(task: Task): Task {
    return task.id === this.blockedId ? task.with({ blockedBy: [...task.blockedBy, this.blockerId] }) : task;
  }

  toJSON(): Record<string, unknown> {
    return { kind: this.kind, blockerId: this.blockerId, blockedId: this.blockedId };
  }
}

export class RemoveBlockingRelation extends Mutation {
  readonly kind = "remove-blocking-relation";
  readonly destructive = true;

  constructor(
    readonly blockerId: string,
    readonly blockedId: string,
  ) {
    super();
    Object.freeze(this);
  }

  get touches(): readonly string[] {
    return [this.blockedId, this.blockerId];
  }

  describe(label: Label): string {
    return `${label(this.blockedId)} is no longer blocked by ${label(this.blockerId)}`;
  }

  apply(writer: TaskWriterPort): Promise<void> {
    return writer.removeBlockingRelation(this.blockerId, this.blockedId);
  }

  satisfiedBy(current: Dag): boolean {
    return current.has(this.blockedId) && !current.blockers(this.blockedId).includes(this.blockerId);
  }

  /** Always destructive, so the gate already covers it; only the task must still be there. */
  preconditionHolds(current: Dag): boolean {
    return current.has(this.blockedId);
  }

  projectEdges(task: Task): Task {
    return task.id === this.blockedId ? task.with({ blockedBy: task.blockedBy.filter((b) => b !== this.blockerId) }) : task;
  }

  toJSON(): Record<string, unknown> {
    return { kind: this.kind, blockerId: this.blockerId, blockedId: this.blockedId };
  }
}

export class SetEstimate extends Mutation {
  readonly kind = "set-estimate";

  constructor(
    readonly taskId: string,
    readonly to: number | null,
    /** What the source held when the plan was made, for the review diff. */
    readonly from: number | null,
  ) {
    super();
    Object.freeze(this);
  }

  /** Replacing or clearing an existing estimate destroys what was there. */
  get destructive(): boolean {
    return this.from !== null;
  }

  get touches(): readonly string[] {
    return [this.taskId];
  }

  describe(label: Label): string {
    return `${label(this.taskId)} estimate ${this.from === null ? "(none)" : String(this.from)} becomes ${this.to === null ? "(none)" : String(this.to)}`;
  }

  apply(writer: TaskWriterPort): Promise<void> {
    return writer.setEstimate(this.taskId, this.to);
  }

  satisfiedBy(current: Dag): boolean {
    return current.has(this.taskId) && (current.get(this.taskId).effort ?? null) === this.to;
  }

  /** The estimate must still be what the plan saw; if it moved, the plan is stale for this card. */
  preconditionHolds(current: Dag): boolean {
    return current.has(this.taskId) && (current.get(this.taskId).effort ?? null) === this.from;
  }

  /** An estimate is not an edge and cannot close a cycle. */
  projectEdges(task: Task): Task {
    return task;
  }

  toJSON(): Record<string, unknown> {
    return { kind: this.kind, taskId: this.taskId, from: this.from, to: this.to };
  }
}

export class SetMilestone extends Mutation {
  readonly kind = "set-milestone";

  constructor(
    readonly taskId: string,
    readonly to: string | null,
    readonly from: string | null,
  ) {
    super();
    Object.freeze(this);
  }

  get destructive(): boolean {
    return this.from !== null;
  }

  get touches(): readonly string[] {
    return [this.taskId];
  }

  describe(label: Label): string {
    return `${label(this.taskId)} milestone ${this.from ?? "(none)"} becomes ${this.to ?? "(none)"}`;
  }

  apply(writer: TaskWriterPort): Promise<void> {
    return writer.setMilestone(this.taskId, this.to);
  }

  satisfiedBy(current: Dag): boolean {
    return current.has(this.taskId) && (current.get(this.taskId).milestone ?? null) === this.to;
  }

  /** The milestone must still be what the plan saw; if it moved, the plan is stale for this card. */
  preconditionHolds(current: Dag): boolean {
    return current.has(this.taskId) && (current.get(this.taskId).milestone ?? null) === this.from;
  }

  /** A milestone is not an edge and cannot close a cycle. */
  projectEdges(task: Task): Task {
    return task;
  }

  toJSON(): Record<string, unknown> {
    return { kind: this.kind, taskId: this.taskId, from: this.from, to: this.to };
  }
}
