import { gsap } from "gsap";
import { motionDuration, motionNumber } from "./MotionPolicy.ts";

/** Animate a visual wrapper, never the graph's layout transform or hit target. */
export class MotionNode {
  readonly visual = document.createElementNS("http://www.w3.org/2000/svg", "g");
  private timeline: gsap.core.Timeline | undefined;
  constructor(readonly node: SVGGraphicsElement) {
    this.visual.classList.add("dag-motion-node");
    if (node.tagName.toLowerCase() === "g") {
      this.visual.append(...Array.from(node.children).filter(child => child.tagName.toLowerCase() !== "title"));
      node.append(this.visual);
    } else {
      node.before(this.visual); this.visual.append(node);
      if (node.classList.contains("eye")) {
        const pupil = node.ownerSVGElement?.querySelector(".pupil");
        if (pupil !== null && pupil !== undefined) { this.visual.append(pupil); }
      }
    }
  }
  wiggle(direction = { x: 1, y: -1 }): void {
    const duration = motionDuration("--motion-node-duration");
    if (duration === 0 || !this.visual.isConnected) { return; }
    this.stop();
    const box = this.visual.getBBox(); const matrix = this.visual.getScreenCTM();
    if (matrix === null) { return; }
    const length = Math.hypot(direction.x, direction.y) || 1;
    const amplitude = motionNumber("--motion-node-distance");
    const inverse = matrix.inverse();
    const origin = new DOMPoint(0, 0).matrixTransform(inverse);
    const offset = new DOMPoint(direction.x / length * amplitude, direction.y / length * amplitude).matrixTransform(inverse);
    const dx = offset.x - origin.x; const dy = offset.y - origin.y;
    const angle = motionNumber("--motion-node-angle") * direction.x / length;
    const damping = motionNumber("--motion-spring-damping"); const frequency = motionNumber("--motion-spring-frequency");
    const pose = { time: 0 };
    this.timeline = gsap.timeline({ onUpdate: () => {
      const spring = Math.exp(-damping * pose.time) * Math.sin(frequency * pose.time) * 2;
      this.visual.setAttribute("transform", `translate(${String(dx * spring)} ${String(dy * spring)}) rotate(${String(angle * spring)} ${String(box.x + box.width / 2)} ${String(box.y + box.height / 2)})`);
    }, onComplete: () => { this.visual.removeAttribute("transform"); this.timeline = undefined; } });
    this.timeline.to(pose, { time: 1, duration, ease: "none" });
  }
  stop(): void { this.timeline?.kill(); this.timeline = undefined; this.visual.removeAttribute("transform"); }
}
