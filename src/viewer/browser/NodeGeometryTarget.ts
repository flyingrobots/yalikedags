/** A player writes to one owned layer; the rig composes layers before drawing. */
export interface NodeGeometryTarget {
  render(offsets: ReadonlyMap<string, { x: number; y: number }>): void;
  restore(): void;
}
