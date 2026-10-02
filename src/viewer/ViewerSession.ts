import type { Analysis } from "../core/services/Analysis.ts";
import { RefreshingAnalysis } from "./RefreshingAnalysis.ts";
import type { ViewerOptions } from "./ViewerMetadata.ts";
import type { ViewerSetup } from "./SetupData.ts";

/** Keep startup credential failures viewable, without disguising unrelated source errors. */
export class ViewerSession {
  private live: RefreshingAnalysis | undefined;
  private setup: ViewerSetup;
  private pending: Promise<void> | undefined;
  constructor(private readonly load: () => Promise<Analysis>, keyTarget: string) {
    this.setup = { kind: "setup", reason: "missing", keyTarget };
  }
  current(): Analysis | ViewerSetup { return this.live?.current ?? this.setup; }
  options(): ViewerOptions {
    return { refresh: true, ...(this.live?.changes !== undefined && { changes: this.live.changes }), ...(this.live?.previous !== undefined && { previous: this.live.previous }) };
  }
  refresh(): Promise<void> {
    this.pending ??= this.read().finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async read(): Promise<void> {
    if (this.live !== undefined) { await this.live.refresh(); return; }
    try { this.live = new RefreshingAnalysis(await this.load(), this.load); }
    catch (error: unknown) {
      if (!(error instanceof Error)) { throw error; }
      if (error.message.startsWith("no_key:")) { this.setup.reason = "missing"; }
      else if (error.message.startsWith("linear_unauthorized:")) { this.setup.reason = "rejected"; }
      else { throw error; }
    }
  }
}
