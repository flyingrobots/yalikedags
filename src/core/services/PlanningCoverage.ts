import type { Grid } from "./GridService.ts";
import { GridService } from "./GridService.ts";
import type { Dag } from "../domain/Dag.ts";
import type { Task } from "../domain/Task.ts";
import type { Workstream } from "./WavesService.ts";
import { WavesService } from "./WavesService.ts";
import { PlanningEvidence } from "./PlanningEvidence.ts";

export interface PlanningCoverageFields {
  dag: Dag;
  grid: Grid;
  waves: readonly (readonly string[])[];
  shared: readonly string[];
  workstreams: readonly Workstream[];
}

/** A validated partition of active captured cards, not a claim of deliverable cohesion or ownership. */
export class PlanningCoverage {
  readonly graphTasks: readonly Task[];
  readonly included: readonly string[];
  readonly excluded: readonly string[];
  readonly containers: readonly string[];
  readonly exceptions: readonly string[];
  readonly shared: readonly string[];
  readonly workstreams: readonly Workstream[];
  readonly crossGroupEdges: readonly { readonly blocker: string; readonly dependent: string }[];

  constructor(f: PlanningCoverageFields) {
    this.graphTasks = Object.freeze(f.dag.tasks.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.included = Object.freeze(this.graphTasks.filter(task => !task.isDone()).map(task => task.id));
    this.excluded = Object.freeze(this.graphTasks.filter(task => task.isDone()).map(task => task.id));
    this.containers = Object.freeze(this.graphTasks.filter(task => !task.isDone() && new PlanningEvidence().kind(task) === "Tracking container").map(task => task.id));
    const scheduled = this.validateWaves(f);
    this.exceptions = Object.freeze(this.included.filter(id => !scheduled.has(id)));
    const membership = this.validateGroups(f, scheduled);
    this.validateGrid(f);
    this.shared = Object.freeze([...f.shared].sort());
    this.workstreams = Object.freeze([...f.workstreams]);
    this.crossGroupEdges = Object.freeze(this.graphTasks.flatMap(task => [...task.blockedBy].sort()
      .filter(blocker => scheduled.has(blocker) && scheduled.has(task.id) && membership.get(blocker) !== membership.get(task.id))
      .map(blocker => Object.freeze({ blocker, dependent: task.id }))));
    Object.freeze(this);
  }

  private validateWaves(f: PlanningCoverageFields): Map<string, number> {
    const included = new Set(this.included);
    const scheduled = new Map<string, number>();
    f.waves.forEach((wave, index) => {
      if (wave.length === 0) { throw new Error("planning: empty wave"); }
      for (const id of wave) {
        if (!included.has(id) || scheduled.has(id)) { throw new Error("planning: wave contains excluded or duplicate task"); }
        scheduled.set(id, index);
      }
    });
    for (const [id, wave] of scheduled) {
      const task = f.dag.get(id);
      if (task.status === "unknown") { throw new Error("planning: unknown task cannot be scheduled"); }
      for (const blocker of task.blockedBy) {
        if (!f.dag.has(blocker)) { throw new Error("planning: missing prerequisite cannot be scheduled"); }
        if (f.dag.get(blocker).satisfiesPrerequisite()) { continue; }
        const prerequisiteWave = scheduled.get(blocker);
        if (prerequisiteWave === undefined || prerequisiteWave >= wave) { throw new Error("planning: waves violate prerequisite order"); }
      }
    }
    this.validateLayers(f.dag, scheduled);
    return scheduled;
  }

  private validateLayers(dag: Dag, scheduled: ReadonlyMap<string, number>): void {
    const expected = new WavesService().waves(dag);
    const ids = expected.flat();
    if (ids.length !== scheduled.size || ids.some(id => !scheduled.has(id))) { throw new Error("planning: wave coverage omitted schedulable work"); }
    if (expected.some((wave, index) => wave.some(id => scheduled.get(id) !== index))) { throw new Error("planning: wave positions disagree with Kahn layers"); }
  }

  private validateGroups(f: PlanningCoverageFields, scheduled: ReadonlyMap<string, number>): Map<string, string> {
    const membership = new Map<string, string>();
    for (const id of f.shared) {
      if (membership.has(id) || !scheduled.has(id)) { throw new Error("planning: invalid shared prerequisite"); }
      membership.set(id, `shared:${id}`);
    }
    f.workstreams.forEach(stream => {
      if (stream.tasks.length === 0 || [...stream.tasks].sort()[0] !== stream.id) { throw new Error("planning: invalid analytical group identity"); }
      for (const id of stream.tasks) {
        if (membership.has(id) || !scheduled.has(id)) { throw new Error("planning: duplicate or unschedulable group member"); }
        membership.set(id, `stream:${stream.id}`);
      }
      this.connected(f.dag, stream);
    });
    if (membership.size !== scheduled.size) { throw new Error("planning: group coverage omitted scheduled work"); }
    this.boundaries(f, scheduled, membership);
    return membership;
  }

  private validateGrid(f: PlanningCoverageFields): void {
    const expected = new GridService().grid(f.waves, f.shared, f.workstreams);
    if (f.grid.waves !== expected.waves || f.grid.rows.length !== expected.rows.length) { throw new Error("planning: grid dimensions disagree with coverage"); }
    f.grid.rows.forEach((row, index) => {
      const wanted = expected.rows[index];
      if (wanted === undefined || row.workstream !== wanted.workstream || row.cells.length !== f.waves.length) { throw new Error("planning: grid row disagrees with coverage"); }
      row.cells.forEach((cell, wave) => {
        const ids = new Set(wanted.cells[wave] ?? []);
        if (cell.length !== ids.size || new Set(cell).size !== ids.size || cell.some(id => !ids.has(id))) { throw new Error("planning: grid cell disagrees with coverage"); }
      });
    });
  }

  private boundaries(f: PlanningCoverageFields, scheduled: ReadonlyMap<string, number>, membership: ReadonlyMap<string, string>): void {
    const shared = new Set(f.shared);
    for (const id of scheduled.keys()) {
      const dependents = f.dag.dependents(id).filter(next => scheduled.has(next));
      if ((dependents.length >= 2) !== shared.has(id)) { throw new Error("planning: shared prerequisite rule mismatch"); }
      for (const next of dependents) {
        if (!shared.has(id) && !shared.has(next) && membership.get(id) !== membership.get(next)) { throw new Error("planning: connected work split across analytical groups"); }
      }
    }
  }

  private connected(dag: Dag, stream: Workstream): void {
    const members = new Set(stream.tasks);
    const visited = new Set<string>();
    const pending = [stream.id];
    while (pending.length > 0) {
      const id = pending.pop();
      if (id === undefined || visited.has(id)) { continue; }
      visited.add(id);
      pending.push(...[...dag.blockers(id), ...dag.dependents(id)].filter(next => members.has(next) && !visited.has(next)));
    }
    if (visited.size !== members.size) { throw new Error("planning: disconnected tasks merged into one analytical group"); }
  }
}
