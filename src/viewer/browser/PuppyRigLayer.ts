import type { NodeGeometryTarget } from "./NodeGeometryTarget.ts";

/** One owner writes each part's base pose. Secondary joint rotations are composed afterward. */
export class PuppyRigLayer implements NodeGeometryTarget {
  readonly offsets = new Map<string, { x: number; y: number }>();
  constructor(readonly ids: readonly string[], private readonly changed: () => void) {}
  render(offsets: ReadonlyMap<string, { x: number; y: number }>): void {
    this.offsets.clear();
    for (const id of this.ids) {
      const point = offsets.get(id);
      if (point !== undefined) { this.offsets.set(id, { x: point.x, y: point.y }); }
    }
    this.changed();
  }
  restore(): void { this.offsets.clear(); this.changed(); }
}
