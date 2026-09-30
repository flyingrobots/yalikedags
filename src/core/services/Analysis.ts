import type { LinearAccount } from "../domain/LinearAccount.ts";
import type { Dag } from "../domain/Dag.ts";
import type { TaskState } from "./StateService.ts";
import type { FrontierEntry } from "./FrontierService.ts";
import type { Workstream } from "./WavesService.ts";
import type { CriticalPath } from "./CriticalPathService.ts";
import type { Finding } from "./AuditService.ts";
import type { Grid } from "./GridService.ts";

export interface AnalysisFields {
  dag: Dag;
  source: string;
  asOf: string;
  account?: LinearAccount | undefined;
  capturedAt?: string | null;
  warnings?: readonly string[];
  states: ReadonlyMap<string, TaskState>;
  frontier: readonly FrontierEntry[];
  conflicts: ReadonlyMap<string, readonly string[]>;
  waves: readonly (readonly string[])[];
  gatekeepers: readonly string[];
  workstreams: readonly Workstream[];
  criticalByDepth: CriticalPath;
  criticalByEffort: CriticalPath;
  findings: readonly Finding[];
  grid: Grid;
}

/** Everything the renderers and the viewer need, computed once from a Dag. Read-only. */
export class Analysis {
  readonly dag: Dag;
  readonly source: string;
  readonly asOf: string;
  readonly account: LinearAccount | undefined;
  readonly capturedAt: string | null;
  readonly warnings: readonly string[];
  readonly states: ReadonlyMap<string, TaskState>;
  readonly frontier: readonly FrontierEntry[];
  readonly conflicts: ReadonlyMap<string, readonly string[]>;
  readonly waves: readonly (readonly string[])[];
  readonly gatekeepers: readonly string[];
  readonly workstreams: readonly Workstream[];
  readonly criticalByDepth: CriticalPath;
  readonly criticalByEffort: CriticalPath;
  readonly findings: readonly Finding[];
  readonly grid: Grid;

  constructor(f: AnalysisFields) {
    this.dag = f.dag;
    this.source = f.source;
    this.account = f.account;
    this.asOf = f.asOf;
    this.capturedAt = f.capturedAt ?? null;
    this.warnings = Object.freeze([...(f.warnings ?? [])]);
    this.states = f.states;
    this.frontier = f.frontier;
    this.conflicts = f.conflicts;
    this.waves = f.waves;
    this.gatekeepers = f.gatekeepers;
    this.workstreams = f.workstreams;
    this.criticalByDepth = f.criticalByDepth;
    this.criticalByEffort = f.criticalByEffort;
    this.findings = f.findings;
    this.grid = f.grid;
    Object.freeze(this);
  }

  stateOf(id: string): TaskState {
    return this.states.get(id) ?? "blocked";
  }

  workstreamOf(id: string): string | undefined {
    return this.workstreams.find((w) => w.tasks.includes(id))?.id;
  }

  isCritical(id: string): boolean {
    return this.criticalByDepth.tasks.includes(id) || this.criticalByEffort.tasks.includes(id);
  }
}
