import { PuppyLimbSkin } from "./PuppyLimbSkin.ts";
import { AnimatedDagGeometry } from "./AnimatedDagGeometry.ts";
import { PUPPY_PARTS, rigRegion } from "./PuppyRigDefinition.ts";
import { PuppyRigLayer } from "./PuppyRigLayer.ts";
import { NodeClipPlayer } from "./NodeClipPlayer.ts";
import { RigAngleTrack } from "./RigAngleTrack.ts";
import type { NodeAnimationClip } from "./NodeAnimationClip.ts";

/** Pose tracks own disjoint regions; head → ears and hips → tail compose in parent order. */
export class PuppyRig {
  private readonly limbs: PuppyLimbSkin;
  readonly geometry: AnimatedDagGeometry;
  readonly tail = new RigAngleTrack(() => { this.queue(); });
  readonly head = new RigAngleTrack(() => { this.queue(); });
  readonly gaze = new RigAngleTrack(() => { this.queue(); });
  readonly bark = new RigAngleTrack(() => { this.queue(); });
  readonly ears = new RigAngleTrack(() => { this.queue(); });
  private readonly layers = new Map<string, PuppyRigLayer>();
  private readonly players = new Map<string, NodeClipPlayer>();
  private frame = 0;
  constructor(private readonly svg: SVGSVGElement) {
    this.geometry = new AnimatedDagGeometry(svg); this.limbs = new PuppyLimbSkin(this.geometry);
    for (const [part, ids] of Object.entries(PUPPY_PARTS)) {
      const layer = new PuppyRigLayer(ids, () => { this.queue(); });
      this.layers.set(part, layer); this.players.set(part, new NodeClipPlayer(layer));
      for (const id of ids) { this.geometry.nodes.get(id)?.circle.setAttribute("data-rig-region", rigRegion(part)); }
    }
  }
  play(clip: NodeAnimationClip, duration: number): void {
    for (const [part, player] of this.players) {
      const ids = this.layers.get(part)?.ids ?? [];
      player.play({ ...clip, frames: clip.frames.map(frame => ({
        ...frame, nodes: Object.fromEntries(Object.entries(frame.nodes).filter(([id]) => ids.includes(id))),
      })) }, duration);
    }
    this.flush();
  }
  pose(): ReadonlyMap<string, { x: number; y: number }> {
    return new Map(Array.from(this.layers.values()).flatMap(layer => Array.from(layer.offsets)));
  }
  private queue(): void {
    if (this.frame === 0) { this.frame = requestAnimationFrame(() => { this.frame = 0; this.flush(); }); }
  }
  flush(): void {
    cancelAnimationFrame(this.frame); this.frame = 0;
    const points = new Map(Array.from(this.geometry.nodes, ([id, node]) => [id, { x: node.x, y: node.y }]));
    for (const layer of this.layers.values()) {
      for (const [id, offset] of layer.offsets) {
        const node = points.get(id); if (node !== undefined) { node.x += offset.x; node.y += offset.y; }
      }
    }
    this.limbs.apply(points);
    this.rotate(points, ["head", "ears"], { pivot: "neck", angle: this.head.pose.angle + this.gaze.pose.angle + this.bark.pose.angle * .25 });
    this.rotate(points, ["ears"], { pivot: "earRoot", angle: this.ears.pose.angle });
    this.rotate(points, ["tail"], { pivot: "tailRoot", angle: this.tail.pose.angle });
    for (const id of ["jaw", "muzzle"]) { const point = points.get(id); if (point !== undefined) { point.y += this.bark.pose.angle; } }
    const offsets = new Map(Array.from(points, ([id, point]) => {
      const rest = this.geometry.nodes.get(id);
      return [id, { x: point.x - (rest?.x ?? 0), y: point.y - (rest?.y ?? 0) }];
    }));
    if (Array.from(offsets.values()).every(point => Math.abs(point.x) < 1e-8 && Math.abs(point.y) < 1e-8)) { this.geometry.restore(); }
    else { this.geometry.render(offsets); }
    this.svg.dispatchEvent(new Event("yalikedags:rig-pose"));
  }
  private rotate(points: Map<string, { x: number; y: number }>, parts: readonly string[], joint: { pivot: string; angle: number }): void {
    const pivot = points.get(joint.pivot); if (pivot === undefined || joint.angle === 0) { return; }
    const cx = pivot.x; const cy = pivot.y; const angle = joint.angle * Math.PI / 180;
    for (const part of parts) {
      for (const id of PUPPY_PARTS[part] ?? []) {
        if (id === "tailJoin") { continue; }
        const point = points.get(id); if (point === undefined) { continue; }
        const x = point.x - cx; const y = point.y - cy;
        point.x = cx + x * Math.cos(angle) - y * Math.sin(angle);
        point.y = cy + x * Math.sin(angle) + y * Math.cos(angle);
      }
    }
  }
  reset(): void {
    this.players.forEach(player => { player.stop(); });
    this.tail.stop(); this.head.stop(); this.ears.stop(); this.gaze.stop(); this.bark.stop();
    cancelAnimationFrame(this.frame); this.frame = 0; this.geometry.restore();
    this.svg.dispatchEvent(new Event("yalikedags:rig-pose"));
  }
}
