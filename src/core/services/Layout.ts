
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
