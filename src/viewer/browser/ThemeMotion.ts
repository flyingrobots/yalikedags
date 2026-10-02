import { gsap } from "gsap";
import { motionDuration, motionPreference } from "./MotionPolicy.ts";

const COLORS = ["canvas", "surface", "raised", "ink", "muted", "accent", "ready", "progress", "blocked", "unresolved", "done", "line", "edge", "hover", "ready-fill", "progress-fill", "blocked-fill", "unresolved-fill", "done-fill"];

/** Browser color-mix handles OKLCH/OKLab tokens; GSAP supplies only the interpolation clock. */
export class ThemeMotion {
  private tween: gsap.core.Tween | undefined;
  private restore: (() => void) | undefined;
  constructor() {
    motionPreference.addEventListener("change", () => { if (motionPreference.matches) { this.stop(); } });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { this.stop(); } });
  }
  change(update: () => void): void {
    const duration = motionDuration("--motion-theme-duration");
    const animate = document.body.dataset["ready"] === "true" && duration > 0;
    const before = animate ? this.colors() : [];
    this.stop(); update();
    if (!animate) { return; }
    const after = this.colors(); const root = document.documentElement;
    const originals = COLORS.map(name => ({ value: root.style.getPropertyValue(`--${name}`), priority: root.style.getPropertyPriority(`--${name}`) }));
    this.restore = (): void => {
      COLORS.forEach((name, index) => {
        const original = originals[index];
        if (original?.value) { root.style.setProperty(`--${name}`, original.value, original.priority); }
        else { root.style.removeProperty(`--${name}`); }
      });
      delete root.dataset["themeTransition"];
    };
    const progress = { value: 0 };
    const paint = (): void => {
      COLORS.forEach((name, index) => { root.style.setProperty(`--${name}`, `color-mix(in oklab, ${before[index] ?? "currentColor"} ${String(100 - progress.value)}%, ${after[index] ?? "currentColor"})`); });
    };
    root.dataset["themeTransition"] = "true"; paint();
    this.tween = gsap.to(progress, { value: 100, duration, ease: "sine.inOut", onUpdate: paint, onComplete: () => { this.stop(); } });
    document.dispatchEvent(new Event("yalikedags:themechange"));
  }
  private colors(): string[] {
    const probe = document.createElement("span"); probe.hidden = true; document.body.append(probe);
    const colors = COLORS.map(name => { probe.style.color = `var(--${name})`; return getComputedStyle(probe).color; });
    probe.remove(); return colors;
  }
  private stop(): void { this.tween?.kill(); this.tween = undefined; this.restore?.(); this.restore = undefined; }
}
