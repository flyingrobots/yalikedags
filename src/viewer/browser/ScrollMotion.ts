import { gsap } from "gsap";
import { motionDuration, motionPreference } from "./MotionPolicy.ts";

/** Scroll actual containers, never the document or keyboard focus; user input cancels. */
export class ScrollMotion {
  private readonly active = new Map<HTMLElement, gsap.core.Tween>();
  constructor() {
    for (const type of ["wheel", "pointerdown", "keydown"]) { document.addEventListener(type, () => { this.stop(); }, { passive: true }); }
    motionPreference.addEventListener("change", () => { if (motionPreference.matches) { this.stop(); } });
  }
  reveal(target: HTMLElement): void {
    this.stop();
    let parent = target.parentElement;
    while (parent !== null && parent !== document.body) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) { this.scroll(parent, target); }
      parent = parent.parentElement;
    }
  }
  private scroll(container: HTMLElement, target: HTMLElement): void {
    const box = container.getBoundingClientRect(); const rect = target.getBoundingClientRect();
    const top = Math.max(0, Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + rect.top - box.top - (container.clientHeight - rect.height) / 2));
    const left = target.tagName === "TR" ? container.scrollLeft : Math.max(0, Math.min(container.scrollWidth - container.clientWidth, container.scrollLeft + rect.left - box.left - (container.clientWidth - rect.width) / 2));
    const duration = motionDuration("--motion-scroll-duration");
    if (duration === 0) { container.scrollTop = top; container.scrollLeft = left; return; }
    this.active.set(container, gsap.to(container, { scrollTop: top, scrollLeft: left, duration, ease: "power2.out", onComplete: () => { this.active.delete(container); } }));
  }
  stop(): void { this.active.forEach(tween => { tween.kill(); }); this.active.clear(); }
}
