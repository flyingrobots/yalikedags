import type { Analysis } from "../core/services/Analysis.ts";
import { JsonSnapshotAdapter } from "../adapters/output/JsonSnapshotAdapter.ts";
import type { ViewerOptions } from "./ViewerMetadata.ts";

/** One JSON contract for HTTP and embedded offline exports. No rendered markup. */
export class ViewerData {
  render(analysis: Analysis, options: ViewerOptions = {}): string {
    return JSON.stringify({ schema: "yalikedags/viewer/1", snapshot: new JsonSnapshotAdapter().toObject(analysis),
      refresh: options.refresh === true, ...(options.changes !== undefined && { changes: options.changes }), ...(options.previous !== undefined && { previous: options.previous }) });
  }
}
