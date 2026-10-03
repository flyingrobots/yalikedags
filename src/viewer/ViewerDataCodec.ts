import { JsonSnapshotRepositoryAdapter } from "../adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { rec, str } from "../adapters/linear/GraphqlJson.ts";
import type { Rec } from "../adapters/linear/GraphqlJson.ts";
import { Analysis } from "../core/services/Analysis.ts";
import { Dag } from "../core/domain/Dag.ts";
import { FrontierEntry } from "../core/services/FrontierService.ts";
import { CriticalPath } from "../core/services/CriticalPathService.ts";
import { Workstream } from "../core/services/WavesService.ts";
import { Grid, GridRow } from "../core/services/GridService.ts";
import { Finding } from "../core/services/AuditService.ts";
import type { FindingKind } from "../core/services/AuditService.ts";
import type { TaskState } from "../core/services/StateService.ts";
import type { ViewerOptions } from "./ViewerMetadata.ts";

const STATES: readonly TaskState[] = ["ready", "blocked", "in-progress", "done", "unresolved"];
const FINDINGS: readonly FindingKind[] = ["isolated", "redundant-edge", "stale-blocker", "canceled-blocker", "dangling-blocker", "cycle", "split-candidate"];

/** Decode server-derived analysis without rerunning scheduling or audit in the browser. */
export class ViewerDataCodec {
  async decode(text: string): Promise<{ analysis: Analysis; options: ViewerOptions }> {
    const raw: unknown = JSON.parse(text);
    const data = rec(raw);
    if (data["schema"] !== "yalikedags/viewer/1") { throw new Error("Unsupported viewer data schema"); }
    const snapshot = rec(data["snapshot"]);
    const repo = new JsonSnapshotRepositoryAdapter(JSON.stringify(snapshot), "viewer data");
    const dag = new Dag(await repo.load());
    const frontier = this.array(snapshot["frontier"]).map(rec);
    const critical = rec(snapshot["criticalPath"]);
    const grid = rec(snapshot["grid"]);
    const analysis = new Analysis({
      review: repo.review,
      dag, source: this.text(snapshot["source"]), asOf: this.text(snapshot["asOf"]),
      capturedAt: repo.capturedAt, warnings: repo.warnings, account: repo.account,
      states: new Map(this.array(snapshot["tasks"]).map((value) => this.state(rec(value)))),
      frontier: frontier.map((entry) => new FrontierEntry({ task: dag.get(this.text(entry["task"])),
        daysUntilDue: this.number(entry["daysUntilDue"]), immediatelyUnblocks: this.number(entry["immediatelyUnblocks"]), downstreamImpact: this.number(entry["downstreamImpact"]) })),
      conflicts: new Map(frontier.map((entry) => [this.text(entry["task"]), this.strings(entry["conflicts"])])),
      waves: this.array(snapshot["waves"]).map((wave) => this.ids(wave, dag)),
      gatekeepers: this.ids(snapshot["gatekeepers"], dag),
      workstreams: this.array(snapshot["workstreams"]).map((value) => {
        const entry = rec(value); return new Workstream(this.text(entry["id"]), this.ids(entry["tasks"], dag));
      }),
      criticalByDepth: this.path(critical["byDepth"], dag), criticalByEffort: this.path(critical["byEffort"], dag),
      grid: new Grid(this.number(grid["waves"]), this.array(grid["rows"]).map((value) => {
        const row = rec(value); return new GridRow(str(row["workstream"]), this.array(row["cells"]).map((cell) => this.ids(cell, dag)));
      })),
      findings: this.array(snapshot["findings"]).map((value) => this.finding(rec(value))),
    });
    return { analysis, options: this.options(data) };
  }

  private options(data: Rec): ViewerOptions {
    if (typeof data["refresh"] !== "boolean") { throw new Error("Invalid refresh capability"); }
    const options: ViewerOptions = { refresh: data["refresh"] };
    if (data["changes"] !== undefined) {
      options.changes = this.array(data["changes"]).map((value) => {
        const row = rec(value);
        return { kind: this.text(row["kind"]), task: this.text(row["task"]), key: this.text(row["key"]), detail: this.text(row["detail"]) };
      });
    }
    if (data["previous"] !== undefined) {
      const previous = rec(data["previous"]);
      options.previous = { source: this.text(previous["source"]), capturedAt: previous["capturedAt"] === null ? null : this.text(previous["capturedAt"]) };
    }
    return options;
  }

  private state(row: Rec): [string, TaskState] {
    const state = STATES.find((value) => value === row["state"]);
    if (state === undefined) { throw new Error("Invalid derived task state"); }
    return [this.text(row["id"]), state];
  }

  private finding(row: Rec): Finding {
    const kind = FINDINGS.find((value) => value === row["kind"]);
    if (kind === undefined) { throw new Error("Invalid finding kind"); }
    return new Finding({ kind, task: this.text(row["task"]), detail: this.text(row["detail"]), wouldKill: this.text(row["wouldKill"]) });
  }

  private path(raw: unknown, dag: Dag): CriticalPath {
    const data = rec(raw);
    return new CriticalPath(this.ids(data["tasks"], dag), this.number(data["length"]));
  }

  private ids(raw: unknown, dag: Dag): string[] {
    const ids = this.strings(raw);
    if (ids.some((id) => !dag.has(id))) { throw new Error("Unknown task in derived view"); }
    return ids;
  }

  private strings(raw: unknown): string[] { return this.array(raw).map((value) => this.text(value)); }
  private array(raw: unknown): unknown[] {
    if (!Array.isArray(raw)) { throw new Error("Expected a list in viewer data"); }
    return raw;
  }
  private text(raw: unknown): string {
    if (typeof raw !== "string") { throw new Error("Expected text in viewer data"); }
    return raw;
  }
  private number(raw: unknown): number {
    if (typeof raw !== "number" || !Number.isFinite(raw)) { throw new Error("Expected a finite number in viewer data"); }
    return raw;
  }
}
