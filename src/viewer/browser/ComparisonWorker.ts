import { comparisonScript } from "../generated/comparison.ts";
import { ComparisonResult } from "./ComparisonResult.ts";

/** One worker per request makes cancellation release computation and prevents stale results. */
export class ComparisonWorker {
  private cancelPending: (() => void) | undefined;
  cancel(): void { this.cancelPending?.(); }

  private create(url: string): Worker {
    try { return new Worker(url); }
    catch (error) { URL.revokeObjectURL(url); throw error; }
  }

  run(file: File, current: string): Promise<ComparisonResult> {
    this.cancel();
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([comparisonScript], { type: "text/javascript" }));
      const worker = this.create(url);
      const finish = (): void => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); this.cancelPending = undefined; };
      const fail = (message: string): void => { finish(); reject(new Error(message)); };
      const timer = setTimeout(() => { fail("Comparison timed out after 15 seconds; try a smaller snapshot."); }, 15000);
      this.cancelPending = (): void => { fail("Comparison canceled; current snapshot retained."); };
      worker.onmessage = (event: MessageEvent<unknown>): void => {
        try { const result = new ComparisonResult(event.data); finish(); resolve(result); }
        catch (error) { fail(error instanceof Error ? error.message : "Invalid comparison response"); }
      };
      worker.onerror = (event): void => { event.preventDefault(); fail("Could not run the local comparison worker."); };
      try { worker.postMessage({ file, current }); }
      catch { fail("Could not send this file to the local comparison worker."); }
    });
  }
}
