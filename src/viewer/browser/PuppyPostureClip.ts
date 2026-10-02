import type { AnimatedDagGeometry } from "./AnimatedDagGeometry.ts";
import type { NodeAnimationClip } from "./NodeAnimationClip.ts";
import { PuppySitClip } from "./PuppySitClip.ts";
import { PUPPY_PARTS } from "./PuppyRigDefinition.ts";

/** Persistent postures and an explicit hips-first route from a sit into a bow. */
export class PuppyPostureClip {
  constructor(private readonly geometry: AnimatedDagGeometry) {}
  packet(name: string, current: ReadonlyMap<string, { x: number; y: number }>): NodeAnimationClip {
    if (name === "sit") {
      const clip = new PuppySitClip(this.geometry).packet();
      return { ...clip, retainPose: true, frames: clip.frames.slice(0, 4) };
    }
    const nodes: Record<string, { x: number; y: number }> = {};
    for (const id of this.geometry.nodes.keys()) { nodes[id] = { x: 0, y: 0 }; }
    if (name === "stand") { return { name, retainPose: true, frames: [{ at: 1, nodes }] }; }
    for (const id of [...PUPPY_PARTS["head"] ?? [], ...PUPPY_PARTS["ears"] ?? []]) {
      nodes[id] = { x: 80, y: 145 };
    }
    const targets: Record<string, readonly [number, number]> = {
      neck: [520, 450], withers: [575, 410], back: [680, 360],
      chest: [490, 550], shoulder: [560, 485], rib: [620, 460],
      belly: [625, 560], waist: [720, 450], flank: [745, 515],
      frontKnee: [535, 600], frontAnkle: [440, 600],
      frontToe: [380, 632], frontPaw: [388, 657], frontHeel: [500, 657],
      farFrontKnee: [625, 565], farFrontHeel: [505, 627], farFrontToe: [425, 607],
      rearKnee: [800, 540], rearAnkle: [830, 605],
      rearToe: [735, 633], rearPaw: [750, 657], rearHeel: [895, 657],
      farRearKnee: [780, 540], farRearToe: [740, 613], farRearHeel: [850, 633],
    };
    for (const [id, [x, y]] of Object.entries(targets)) {
      const rest = this.geometry.nodes.get(id);
      if (rest !== undefined) { nodes[id] = { x: x - rest.x, y: y - rest.y }; }
    }
    const raised = this.raiseHips(current);
    return { name: "bow", retainPose: true, frames: [{ at: .35, nodes: raised }, { at: 1, nodes }] };
  }
  private raiseHips(current: ReadonlyMap<string, { x: number; y: number }>): Record<string, { x: number; y: number }> {
    const raised: Record<string, { x: number; y: number }> = {};
    for (const id of this.geometry.nodes.keys()) {
      const point = current.get(id);
      raised[id] = { x: point?.x ?? 0, y: point?.y ?? 0 };
    }
    for (const part of ["hindlegs", "farHindleg", "tail"]) {
      for (const id of PUPPY_PARTS[part] ?? []) { raised[id] = { x: 0, y: 0 }; }
    }
    for (const id of ["hip", "rump", "haunch", "flank", "waist"]) { raised[id] = { x: 0, y: 0 }; }
    return raised;
  }
}
