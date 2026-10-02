/** A serializable clip packet: offsets from authored node positions at normalized times. */
export interface NodeAnimationClip {
  readonly name: string;
  readonly retainPose?: boolean;
  readonly frames: readonly {
    readonly at: number;
    readonly hold?: number;
    readonly nodes: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  }[];
}
