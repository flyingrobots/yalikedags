import type { Analysis } from "../core/services/Analysis.ts";
import { SnapshotChangesService } from "../core/services/SnapshotChangesService.ts";
import type { SnapshotChange } from "../core/services/SnapshotChangesService.ts";

/** Publish only a complete successful read. Concurrent requests share one read. */
export class RefreshingAnalysis {
  previous: { source: string; capturedAt: string | null } | undefined;
  changes: readonly SnapshotChange[] | undefined;
  private pending: Promise<void> | undefined;
  constructor(public current: Analysis, private readonly load: () => Promise<Analysis>) {}

  refresh(): Promise<void> {
    this.pending ??= this.read().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async read(): Promise<void> {
    const next = await this.load();
    this.changes = new SnapshotChangesService().compare(this.current.dag, next.dag);
    this.previous = { source: this.current.source, capturedAt: this.current.capturedAt };
    this.current = next;
  }
}
