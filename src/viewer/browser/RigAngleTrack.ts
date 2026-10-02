import { gsap } from "gsap";

/** An additive joint track owns a single angle; interruptions blend from its current value. */
export class RigAngleTrack {
  readonly pose = { angle: 0 };
  private timeline: gsap.core.Timeline | undefined;
  constructor(private readonly changed: () => void) {}
  play(values: readonly number[], duration: number): void {
    if (duration <= 0) { this.stop(); return; }
    this.timeline?.kill();
    this.timeline = gsap.timeline({ onUpdate: this.changed, onComplete: () => { this.timeline = undefined; } });
    for (const angle of values) {
      this.timeline.to(this.pose, { angle, duration: duration / values.length, ease: "sine.inOut" });
    }
  }
  stop(): void { this.timeline?.kill(); this.timeline = undefined; this.pose.angle = 0; this.changed(); }
}
