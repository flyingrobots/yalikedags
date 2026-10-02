import { Dag } from "../domain/Dag.ts";
import { ConnectedLayoutService } from "./ConnectedLayoutService.ts";
import { Layout, PlacedNode } from "./Layout.ts";
export { Layout, PlacedNode } from "./Layout.ts";

/** Pack weak components without changing graph semantics; isolated cards occupy a separate grid. */
export class LayeredLayoutService {
  layout(dag: Dag): Layout {
    const components = this.components(dag);
    const isolated = components.filter(ids => ids.length === 1 && dag.blockers(ids[0] ?? "").length === 0);
    const connected = components.filter(ids => !isolated.includes(ids)).map(ids =>
      new ConnectedLayoutService().layout(new Dag(ids.map(id => dag.get(id)))))
      .sort((a, b) => b.maxRows - a.maxRows || b.layerCount - a.layerCount);
    const area = connected.reduce((sum, tile) => sum + (tile.layerCount + 1) * (tile.maxRows + 1), 0) + isolated.length;
    const width = Math.max(1, ...connected.map(tile => tile.layerCount), Math.ceil(Math.sqrt(area * .5)));
    const nodes: PlacedNode[] = [];
    let x = 0; let y = 0; let shelf = 0; let usedWidth = 0;
    for (const tile of connected) {
      if (x > 0 && x + tile.layerCount > width) { y += shelf + 1; x = 0; shelf = 0; }
      nodes.push(...tile.nodes.map(node => new PlacedNode(node.id, node.layer + x, node.row + y)));
      shelf = Math.max(shelf, tile.maxRows); usedWidth = Math.max(usedWidth, x + tile.layerCount);
      x += tile.layerCount + 1;
    }
    const isolatedY = connected.length === 0 ? .5 : y + shelf + 1.5;
    isolated.flat().sort().forEach((id, i) => { nodes.push(new PlacedNode(id, i % width, isolatedY + Math.floor(i / width))); });
    const rows = isolated.length > 0 ? isolatedY + Math.ceil(isolated.length / width) : y + shelf;
    return new Layout(nodes, Math.max(usedWidth, Math.min(width, isolated.length)), rows);
  }
  private components(dag: Dag): string[][] {
    const remaining = new Set(dag.tasks.map(task => task.id)); const groups: string[][] = [];
    for (const root of remaining) {
      const ids: string[] = []; const stack = [root]; remaining.delete(root);
      while (stack.length > 0) {
        const id = stack.pop(); if (id === undefined) { break; }
        ids.push(id);
        const neighbors = [...dag.blockers(id), ...dag.dependents(id)].filter(neighbor => remaining.delete(neighbor));
        stack.push(...neighbors);
      }
      groups.push(ids);
    }
    return groups;
  }
}
