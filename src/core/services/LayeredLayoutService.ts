import type { Dag } from "../domain/Dag.ts";

export class PlacedNode {
  constructor(
    readonly id: string,
    /** Column: 0 for tasks with no blockers, otherwise one past the deepest blocker. */
    readonly layer: number,
    /** Row within the column after barycenter ordering. */
    readonly row: number,
  ) {
    Object.freeze(this);
  }
}

export class Layout {
  constructor(
    readonly nodes: readonly PlacedNode[],
    readonly layerCount: number,
    readonly maxRows: number,
  ) {
    Object.freeze(this);
  }

  position(id: string): PlacedNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }
}

/**
 * Sugiyama-style layered layout without dummy nodes: longest-path
 * layering, then a few barycenter sweeps to reduce crossings. Pure, so the
 * browser page and the SVG renderer share it. Cycles are broken by
 * ignoring back edges; the audit reports the cycle itself.
 */
export class LayeredLayoutService {
  layout(dag: Dag): Layout {
    const columns = this.columns(this.layers(dag));
    const layerCount = columns.size;
    for (let sweep = 0; sweep < 4; sweep += 1) {
      this.sweepDown(columns, layerCount, dag);
      this.sweepUp(columns, layerCount, dag);
    }
    const nodes: PlacedNode[] = [];
    let maxRows = 0;
    for (const [layer, ids] of columns) {
      ids.forEach((id, row) => nodes.push(new PlacedNode(id, layer, row)));
      maxRows = Math.max(maxRows, ids.length);
    }
    return new Layout(nodes, layerCount, maxRows);
  }

  private columns(layerOf: Map<string, number>): Map<number, string[]> {
    const columns = new Map<number, string[]>();
    for (const [id, layer] of layerOf) {
      columns.set(layer, [...(columns.get(layer) ?? []), id]);
    }
    return new Map([...columns].sort(([a], [b]) => a - b).map(([k, v]) => [k, v.sort()]));
  }

  private sweepDown(columns: Map<number, string[]>, layerCount: number, dag: Dag): void {
    for (let l = 1; l < layerCount; l += 1) {
      columns.set(l, this.byBarycenter(columns.get(l) ?? [], columns.get(l - 1) ?? [], (id) => dag.blockers(id)));
    }
  }

  private sweepUp(columns: Map<number, string[]>, layerCount: number, dag: Dag): void {
    for (let l = layerCount - 2; l >= 0; l -= 1) {
      columns.set(l, this.byBarycenter(columns.get(l) ?? [], columns.get(l + 1) ?? [], (id) => dag.dependents(id)));
    }
  }

  private layers(dag: Dag): Map<string, number> {
    const memo = new Map<string, number>();
    const visiting = new Set<string>();
    const depth = (id: string): number => {
      const known = memo.get(id);
      if (known !== undefined) {
        return known;
      }
      if (visiting.has(id)) {
        return 0;
      }
      visiting.add(id);
      const d = dag.blockers(id).reduce((acc, b) => Math.max(acc, depth(b) + 1), 0);
      visiting.delete(id);
      memo.set(id, d);
      return d;
    };
    for (const t of dag.tasks) {
      depth(t.id);
    }
    return memo;
  }

  private byBarycenter(ids: string[], neighbours: string[], links: (id: string) => string[]): string[] {
    const index = new Map(neighbours.map((n, i) => [n, i]));
    const center = (id: string): number => {
      const idx = links(id).map((n) => index.get(n)).filter((i): i is number => i !== undefined);
      return idx.length === 0 ? Number.POSITIVE_INFINITY : idx.reduce((a, b) => a + b, 0) / idx.length;
    };
    return [...ids].sort((a, b) => center(a) - center(b) || a.localeCompare(b));
  }
}
