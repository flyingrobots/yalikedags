import type { AnimatedDagGeometry } from "./AnimatedDagGeometry.ts";
import type { NodeAnimationClip } from "./NodeAnimationClip.ts";

/** Five authored poses: anticipation, lowering, paw adjustment, seated hold, standing. */
export class PuppySitClip {
  constructor(private readonly geometry: AnimatedDagGeometry) {}
  packet(): NodeAnimationClip {
    const seated: Record<string, readonly [number, number]> = {
      neck: [680, 350], withers: [700, 375], back: [780, 408], hip: [841, 475], rump: [871, 540],
      chest: [540, 444], shoulder: [610, 427], rib: [665, 452], waist: [734, 480], haunch: [749, 528],
      belly: [620, 518], flank: [684, 563], rearKnee: [683, 591],
      rearAnkle: [714, 626], rearToe: [636, 635], rearPaw: [643, 657],
      rearHeel: [792, 657], rearHock: [843, 637], rearTop: [871, 590],
      farRearKnee: [714, 560], farRearToe: [615, 612], farRearHeel: [699, 632],
      tailRoot: [891, 525], tailBase: [960, 565], tailBend: [980, 625], tailEnd: [910, 665], tailTip: [830, 610],
      tailOuter: [850, 605], tailEndOuter: [905, 640], tailArc: [950, 620], tailBaseOuter: [925, 590], tailJoin: [905, 570],
      frontKnee: [530, 514], frontAnkle: [522, 605], frontToe: [481, 632],
      frontPaw: [488, 657], frontHeel: [561, 657], frontBack: [570, 600], frontTop: [583, 492],
      farFrontKnee: [590, 532], farFrontHeel: [607, 621], farFrontToe: [558, 607], farFrontBack: [633, 637],
    };
    for (const id of ["nose", "bridge", "brow", "forehead", "crown", "eye", "muzzle", "jaw", "cheek", "earRoot", "earOuter", "earBend", "earTip", "earInner", "earFold"]) {
      const node = this.geometry.nodes.get(id);
      if (node !== undefined) { seated[id] = [node.x + 230, node.y]; }
    }
    return { name: "sit", frames: [
      { at: .10, nodes: this.pose(seated, .10, 0) },
      { at: .30, nodes: this.pose(seated, .85, 1) },
      { at: .43, nodes: this.pose(seated, 1, 2) },
      { at: .62, hold: .18, nodes: this.pose(seated, 1, 0) },
      { at: 1, nodes: this.pose(seated, 0, 0) },
    ] };
  }
  private pose(targets: Readonly<Record<string, readonly [number, number]>>, amount: number, paw: number): Record<string, { x: number; y: number }> {
    const offsets: Record<string, { x: number; y: number }> = {};
    for (const [id, [x, y]] of Object.entries(targets)) {
      const node = this.geometry.nodes.get(id);
      if (node !== undefined) { offsets[id] = { x: (x - node.x) * amount, y: (y - node.y) * amount }; }
    }
    for (const id of ["frontAnkle", "frontToe", "frontPaw", "frontHeel", "frontBack"]) {
      offsets[id] = { x: 100 * amount + (paw === 1 ? -10 : 0), y: paw === 1 ? -28 : 0 };
    }
    for (const id of ["farFrontKnee", "farFrontHeel", "farFrontToe", "farFrontBack"]) {
      offsets[id] = { x: 80 * amount + (paw === 2 ? -7 : 0), y: paw === 2 ? -21 : 0 };
    }
    return offsets;
  }
}
