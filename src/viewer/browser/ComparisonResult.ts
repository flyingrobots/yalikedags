import { rec, str } from "../../adapters/linear/GraphqlJson.ts";
import type { SnapshotChange } from "../../core/services/SnapshotChangesService.ts";

/** Structured-clone data is validated again before it reaches UI state. */
export class ComparisonResult {
  readonly changes: readonly SnapshotChange[];
  readonly capturedAt: string | null;
  constructor(raw: unknown) {
    const data = rec(raw); const error = str(data["error"]);
    if (error !== undefined) { throw new Error(error); }
    const changes = data["changes"];
    if (!Array.isArray(changes)) { throw new Error("Invalid comparison response"); }
    this.changes = changes.map((value: unknown) => {
      const row = rec(value);
      return { kind: this.text(row["kind"]), task: this.text(row["task"]), key: this.text(row["key"]), detail: this.text(row["detail"]) };
    });
    this.capturedAt = data["capturedAt"] === null ? null : this.text(data["capturedAt"]);
  }
  private text(value: unknown): string {
    if (typeof value !== "string") { throw new Error("Invalid comparison field"); }
    return value;
  }
}
