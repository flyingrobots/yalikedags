import { gsap } from "gsap";
import { motionDuration, motionPreference } from "./MotionPolicy.ts";

export function revealDrawer(panel: HTMLElement): void {
  gsap.killTweensOf(panel);
  const duration = motionDuration("--motion-drawer-duration");
  if (duration > 0) { gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, duration, ease: "power2.out", clearProps: "transform,opacity" }); }
}
export function stopDrawer(panel: HTMLElement): void {
  gsap.killTweensOf(panel); panel.style.removeProperty("transform"); panel.style.removeProperty("opacity");
}

motionPreference.addEventListener("change", () => {
  const panel = document.getElementById("inspector");
  if (motionPreference.matches && panel !== null) { stopDrawer(panel); }
});
