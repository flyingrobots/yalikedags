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
  wiggle(sign = 1): void {
    const duration = motionDuration("--motion-node-duration");
    if (duration === 0 || !this.visual.isConnected || this.node.hasAttribute("data-clip-track")) { return; }
    this.stop();
    const box = this.visual.getBBox(); const matrix = this.visual.getScreenCTM();
    if (matrix === null) { return; }
    const distance = motionNumber("--motion-node-distance") / Math.max(.01, Math.hypot(matrix.a, matrix.b));
    const angle = motionNumber("--motion-node-angle") * sign;
    const pose = { x: 0, y: 0, rotation: 0 };
    this.timeline = gsap.timeline({ onUpdate: () => {
      this.visual.setAttribute("transform", `translate(${String(pose.x)} ${String(pose.y)}) rotate(${String(pose.rotation)} ${String(box.x + box.width / 2)} ${String(box.y + box.height / 2)})`);
    }, onComplete: () => { this.visual.removeAttribute("transform"); this.timeline = undefined; } });
    this.timeline.to(pose, { x: distance * sign, y: -distance, rotation: angle, duration: duration * .2, ease: "power2.out" })
      .to(pose, { x: -distance * sign * .5, y: distance * .3, rotation: -angle * .5, duration: duration * .25, ease: "sine.inOut" })
      .to(pose, { x: 0, y: 0, rotation: 0, duration: duration * .55, ease: "elastic.out(1, 0.5)" });
  }
  stop(): void { this.timeline?.kill(); this.timeline = undefined; this.visual.removeAttribute("transform"); }
}
