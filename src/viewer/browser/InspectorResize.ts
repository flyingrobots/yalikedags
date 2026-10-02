import { stopDrawer } from "./DrawerMotion.ts";
import { motionNumber } from "./MotionPolicy.ts";
import { element } from "./Dom.ts";

/** Pointer capture supports mouse/touch; arrow keys offer the same bounded adjustment. */
export class InspectorResize {
  private readonly panel = element("inspector");
  private readonly handle = element("inspector-resize");
  private drag: { x: number; width: number } | undefined;
  constructor() {
    try { const width = Number(localStorage.getItem("yalikedags.inspector-width")); if (width >= 280) { this.set(width); } } catch { /* Optional storage. */ }
    this.handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) { return; }
      stopDrawer(this.panel);
      event.preventDefault(); this.drag = { x: event.clientX, width: this.panel.getBoundingClientRect().width };
      this.handle.setPointerCapture(event.pointerId);
    });
    this.handle.addEventListener("pointermove", (event) => { if (this.drag !== undefined) { this.set(this.drag.width + this.drag.x - event.clientX); } });
    this.handle.addEventListener("pointerup", () => { this.drag = undefined; this.save(); });
    this.handle.addEventListener("pointercancel", () => { this.drag = undefined; });
    this.handle.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { return; }
      event.preventDefault(); this.set(this.keyWidth(event.key)); this.save();
    });
    new ResizeObserver(() => { this.updateAria(); }).observe(this.panel);
  }
  private maximum(): number { return Math.max(280, Math.min(motionNumber("--inspector-max-width"), innerWidth - 32)); }
  private keyWidth(key: string): number {
    if (key === "Home") { return 280; }
    if (key === "End") { return this.maximum(); }
    return this.panel.getBoundingClientRect().width + (key === "ArrowLeft" ? 32 : -32);
  }
  private set(width: number): void {
    this.panel.style.setProperty("--inspector-user-width", `${String(Math.min(this.maximum(), Math.max(280, width)))}px`);
    this.updateAria();
  }
  private updateAria(): void {
    this.handle.setAttribute("aria-valuemin", "280"); this.handle.setAttribute("aria-valuemax", String(this.maximum()));
    this.handle.setAttribute("aria-valuenow", String(Math.round(this.panel.getBoundingClientRect().width)));
  }
  private save(): void {
    try { localStorage.setItem("yalikedags.inspector-width", String(this.panel.getBoundingClientRect().width)); } catch { /* Optional storage. */ }
  }
}
