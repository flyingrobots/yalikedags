import { Analysis } from "../../core/services/Analysis.ts";
import { Dag } from "../../core/domain/Dag.ts";
import { SvgRendererAdapter } from "../../adapters/output/SvgRendererAdapter.ts";
import { element } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";
import type { GraphController } from "./GraphController.ts";

/** Re-layout a bounded subgraph entirely in the client; the full-project viewport is retained. */
export class GraphNeighborhood {
  private visible: Set<string>;
  private active = false;
  private hops = 1;
  private root: string | undefined;
  private saved = "";
  constructor(private readonly analysis: Analysis, private readonly state: ViewerState, private readonly graph: GraphController) {
    this.visible = new Set(analysis.dag.tasks.map((t) => t.id));
    element("graph-neighborhood").addEventListener("click", () => { this.focus(); });
    element("graph-expand").addEventListener("click", () => { this.hops += 1; this.render(); this.state.select(this.state.selected); });
    element("graph-all").addEventListener("click", () => { this.all(); this.state.select(this.state.selected); });
    state.subscribe(() => {
      const button = element("graph-neighborhood");
      if (button instanceof HTMLButtonElement) { button.disabled = state.selected === undefined; }
      if (this.active && state.selected === undefined) { this.all(); }
      else if (this.active && this.root !== state.selected) { this.hops = 1; this.render(); }
    });
  }

  filter(ids: Set<string>): void {
    this.visible = ids; this.active = false; this.root = undefined;
    if (this.state.selected !== undefined && !ids.has(this.state.selected)) { this.state.select(undefined); }
    this.all(); this.graph.readable(); this.state.select(this.state.selected);
  }

  focus(): void {
    if (this.state.selected === undefined) { return; }
    if (!this.active) { this.saved = this.graph.viewport(); }
    this.active = true; this.hops = 1; this.render(); this.state.select(this.state.selected);
  }

  private ids(): Set<string> {
    const ids = new Set(this.state.selected === undefined ? [] : [this.state.selected]);
    for (let hop = 0; hop < this.hops; hop += 1) {
      for (const id of [...ids]) {
        this.state.dag.blockers(id).forEach((n) => ids.add(n));
        this.state.dag.dependents(id).forEach((n) => ids.add(n));
      }
    }
    return new Set([...ids].filter((id) => this.visible.has(id)));
  }

  private render(): void {
    this.root = this.state.selected;
    const ids = this.ids();
    this.scene(ids);
    this.graph.readable();
    element("graph-expand").hidden = ids.size >= this.visible.size;
    element("graph-all").hidden = false;
    element("graph-scope-status").textContent = `${String(ids.size)} of ${String(this.analysis.dag.size)} tasks · ${String(this.hops)} hops from ${this.analysis.dag.get(this.root ?? "").key} · expand to reveal more`;
  }

  private scene(ids: Set<string>): void {
    const tasks = this.analysis.dag.tasks.filter((task) => ids.has(task.id)).map((task) => task.with({ blockedBy: task.blockedBy.filter((id) => ids.has(id)) }));
    this.graph.scene(new SvgRendererAdapter().render(this.subgraph(new Dag(tasks))));
  }

  private subgraph(dag: Dag): Analysis {
    const a = this.analysis;
    return new Analysis({ dag, source: a.source, asOf: a.asOf, states: a.states, frontier: a.frontier,
      conflicts: a.conflicts, waves: a.waves, gatekeepers: a.gatekeepers, workstreams: a.workstreams,
      criticalByDepth: a.criticalByDepth, criticalByEffort: a.criticalByEffort, grid: a.grid, findings: a.findings });
  }

  private all(): void {
    this.active = false; this.root = undefined;
    this.scene(this.visible);
    this.graph.restoreViewport(this.saved);
    element("graph-expand").hidden = true; element("graph-all").hidden = true;
    element("graph-scope-status").textContent = `${String(this.visible.size)} tasks · current graph filters`;
  }
}
