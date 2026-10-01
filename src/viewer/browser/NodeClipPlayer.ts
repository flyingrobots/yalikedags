import { gsap } from "gsap";
import type { NodeGeometryTarget } from "./NodeGeometryTarget.ts";
import type { NodeAnimationClip } from "./NodeAnimationClip.ts";

/** One GSAP timeline interpolates all node tracks, updating connected edges once per frame. */
export class NodeClipPlayer {
  private offsets = new Map<string, { x: number; y: number }>();
  private timeline: gsap.core.Timeline | undefined;
  constructor(private readonly geometry: NodeGeometryTarget) {}
  play(clip: NodeAnimationClip, duration: number): void {
    if (duration <= 0) { this.stop(); return; }
    this.timeline?.kill();
    const offsets = new Map(Array.from(this.offsets, ([id, pose]) => [id, { x: pose.x, y: pose.y }]));
    const timeline = gsap.timeline({ paused: true, onUpdate: () => { this.geometry.render(offsets); }, onComplete: () => { if (clip.retainPose === true) { this.timeline = undefined; } else { this.stop(); } } });
    let previous = 0;
    for (const frame of clip.frames) {
      for (const [id, target] of Object.entries(frame.nodes)) {
        let pose = offsets.get(id);
        if (pose === undefined) { pose = { x: 0, y: 0 }; offsets.set(id, pose); }
        timeline.to(pose, { x: target.x, y: target.y, duration: (frame.at - previous) * duration, ease: "sine.inOut" }, previous * duration);
      }
      previous = frame.at + (frame.hold ?? 0);
    }
    for (const [id, pose] of offsets) {
      if (!clip.frames.some(frame => frame.nodes[id] !== undefined)) {
        timeline.to(pose, { x: 0, y: 0, duration, ease: "sine.inOut" }, 0);
      }
    }
    this.offsets = offsets;
    this.geometry.render(offsets);
    this.timeline = timeline; timeline.play();
  }
  get playing(): boolean { return this.timeline !== undefined; }
  stop(): void { this.timeline?.kill(); this.timeline = undefined; this.offsets.clear(); this.geometry.restore(); }
}
