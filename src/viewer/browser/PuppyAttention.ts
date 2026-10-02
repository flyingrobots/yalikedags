import type { PuppyRig } from "./PuppyRig.ts";
import { motionDuration, motionNumber, motionPreference } from "./MotionPolicy.ts";

/** Single-joint aim IK and infrequent idle gestures compose with the held body pose. */
export class PuppyAttention {
  private frame = 0;
  private pointer = { x: 0, y: 0 };
  constructor(private readonly svg: SVGSVGElement, private readonly rig: PuppyRig) {
    document.addEventListener("pointermove", event => {
      if (event.pointerType === "touch") { return; }
      this.pointer = { x: event.clientX, y: event.clientY };
      if (this.frame === 0) { this.frame = requestAnimationFrame(() => { this.frame = 0; this.aim(); }); }
    });
    document.addEventListener("pointerleave", () => { this.rig.gaze.play([0], motionDuration("--motion-gaze-duration")); });
    document.addEventListener("visibilitychange", () => { cancelAnimationFrame(this.frame); this.frame = 0; });
  }
  private visible(): boolean {
    const box = this.svg.getBoundingClientRect();
    return !document.hidden && !motionPreference.matches && box.width > 0 && box.bottom > 0 && box.top < innerHeight;
  }
  private aim(): void {
    if (!this.visible()) { return; }
    const box = this.svg.getBoundingClientRect();
    const distance = Math.hypot(Math.max(box.left - this.pointer.x, 0, this.pointer.x - box.right), Math.max(box.top - this.pointer.y, 0, this.pointer.y - box.bottom));
    if (distance > motionNumber("--motion-gaze-radius")) { this.rig.gaze.play([0], motionDuration("--motion-gaze-duration")); return; }
    this.svg.dispatchEvent(new Event("yalikedags:puppy-attention"));
    this.track();
  }
  private track(): void {
    const eye = this.rig.geometry.nodes.get("eye"); const neck = this.rig.geometry.nodes.get("neck");
    const matrix = neck?.circle.getScreenCTM();
    if (eye === undefined || neck === undefined || matrix === null || matrix === undefined) { return; }
    const point = new DOMPoint(this.pointer.x, this.pointer.y).matrixTransform(matrix.inverse());
    const pose = this.rig.pose(); const n = pose.get("neck") ?? { x: 0, y: 0 }; const e = pose.get("eye") ?? { x: 0, y: 0 };
    const nx = neck.x + n.x; const ny = neck.y + n.y;
    const target = Math.atan2(point.y - ny, point.x - nx);
    const rest = Math.atan2(eye.y + e.y - ny, eye.x + e.x - nx);
    const delta = Math.atan2(Math.sin(target - rest), Math.cos(target - rest)) * 180 / Math.PI;
    const limit = motionNumber("--motion-gaze-angle");
    this.rig.gaze.play([Math.max(-limit, Math.min(limit, delta))], motionDuration("--motion-gaze-duration"));
  }
}
