import { PuppySitClip } from "./PuppySitClip.ts";
import { PuppyPostureClip } from "./PuppyPostureClip.ts";
import { PuppyRig } from "./PuppyRig.ts";
import { PuppyRigDebug } from "./PuppyRigDebug.ts";
import { motionDuration, motionNumber, motionPreference } from "./MotionPolicy.ts";

/** Independent posture and secondary tracks share one skeletal skin. */
export class PuppyMotion {
  private readonly rig: PuppyRig;
  constructor(private readonly svg: SVGSVGElement) {
    this.rig = new PuppyRig(svg); new PuppyRigDebug(svg);
    svg.addEventListener("pointerenter", () => { this.wag(); });
    svg.addEventListener("click", () => { this.sit(); });
    svg.closest("a")?.addEventListener("focus", () => { this.wag(); });
    document.addEventListener("yalikedags:themechange", () => { this.wag(); });
    document.addEventListener("yalikedags:puppy-action", () => { this.action(); });
    motionPreference.addEventListener("change", () => { this.rig.reset(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { this.rig.reset(); } });
  }
  private sit(): void {
    if (document.hidden) { return; }
    this.svg.dispatchEvent(new Event("yalikedags:clip-start"));
    this.rig.play(new PuppySitClip(this.rig.geometry).packet(), motionDuration("--motion-sit-duration"));
  }
  private wag(): void {
    if (document.hidden || this.svg.getBoundingClientRect().width === 0) { return; }
    const angle = motionNumber("--motion-tail-angle");
    this.rig.tail.play([angle, -angle, angle, -angle, angle * .7, -angle * .4, 0], motionDuration("--motion-tail-duration"));
  }
  private action(): void {
    const action = document.documentElement.dataset["puppyAction"];
    if (document.hidden) { return; }
    if (action === "wag") { this.wag(); return; }
    if (action === "tilt") {
      const angle = motionNumber("--motion-head-angle");
      this.rig.head.play([angle, angle, 0], motionDuration("--motion-head-duration")); return;
    }
    if (action === "ears") {
      const angle = motionNumber("--motion-ear-angle");
      this.rig.ears.play([angle, -angle, angle * .7, -angle * .4, 0], motionDuration("--motion-ear-duration")); return;
    }
    if (action === "stand" || action === "sit" || action === "bow") {
      this.svg.dispatchEvent(new Event("yalikedags:clip-start"));
      this.rig.play(new PuppyPostureClip(this.rig.geometry).packet(action, this.rig.pose()), motionDuration("--motion-posture-duration"));
    }
  }
}
