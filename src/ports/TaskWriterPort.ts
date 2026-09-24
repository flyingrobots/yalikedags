/**
 * Output port: the only way anything in this tool changes a task at its source.
 *
 * Deliberately narrow. Status, assignee, priority and title are owned by the
 * source (see docs/explanation/source-of-truth.md) and have no method here, so
 * no amount of reconciliation can push them back. What the graph owns is the
 * dependency edges; estimate and milestone are included because a plan can
 * carry them and they are single scalars with no workflow behind them.
 *
 * Every method is idempotent from the caller's point of view: asking for a
 * relation that already exists, or an estimate that is already set, must not
 * fail. The apply path relies on that, because a partially applied plan is
 * re-runnable only if repeating a landed mutation is harmless.
 */
export interface TaskWriterPort {
  /** One human-readable line naming what is being written to, for receipts and dry runs. */
  describe(): string;

  /** Record that `blockerId` must finish before `blockedId` can start. */
  addBlockingRelation(blockerId: string, blockedId: string): Promise<void>;

  /** Remove that relation. Destructive: it deletes something a person may have entered. */
  removeBlockingRelation(blockerId: string, blockedId: string): Promise<void>;

  /** Set the effort estimate. `null` clears it. */
  setEstimate(taskId: string, effort: number | null): Promise<void>;

  /** Set the milestone by name. `null` clears it. The adapter resolves the name. */
  setMilestone(taskId: string, milestoneName: string | null): Promise<void>;
}
