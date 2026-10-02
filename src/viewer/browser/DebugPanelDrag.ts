import { gsap } from "gsap";
import { Draggable } from "gsap/Draggable";
import { motionDuration, motionNumber } from "./MotionPolicy.ts";

/** A dedicated drag handle leaves tool buttons, selection, and textarea scrolling untouched. */
export class DebugPanelDrag {
  private readonly drag: Draggable | undefined;
  constructor(private readonly panel: HTMLElement, handle: HTMLElement) {
    gsap.registerPlugin(Draggable);
    const start = this.saved();
    gsap.set(panel, { x: start.x, y: start.y });
    this.drag = Draggable.create(panel, {
      type: "x,y", trigger: handle, dragClickables: true, zIndexBoost: false, edgeResistance: 1, bounds: this.bounds(),
      onPress: () => { gsap.killTweensOf(panel); }, onDragEnd: () => { this.save(); },
    })[0];
    handle.addEventListener("keydown", event => { this.keyboard(event); });
    new ResizeObserver(() => { this.constrain(); }).observe(panel);
    window.addEventListener("resize", () => { this.constrain(); });
    window.visualViewport?.addEventListener("resize", () => { this.constrain(); });
  }
  private bounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    return { minX: 0, minY: 0, maxX: Math.max(0, innerWidth - this.panel.offsetWidth), maxY: Math.max(0, innerHeight - this.panel.offsetHeight) };
  }
  private constrain(): void { gsap.killTweensOf(this.panel); this.drag?.applyBounds(this.bounds()); }
  private keyboard(event: KeyboardEvent): void {
    const directions: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key]; if (direction === undefined || this.drag === undefined) { return; }
    event.preventDefault();
    const step = motionNumber("--debug-key-step") * (event.shiftKey ? 4 : 1); const bounds = this.bounds();
    gsap.to(this.panel, {
      x: Math.max(0, Math.min(bounds.maxX, this.drag.x + direction[0] * step)),
      y: Math.max(0, Math.min(bounds.maxY, this.drag.y + direction[1] * step)),
      duration: motionDuration("--debug-move-duration"), overwrite: true,
      onUpdate: () => { this.drag?.update(); }, onComplete: () => { this.save(); },
    });
  }
  private saved(): { x: number; y: number } {
    try {
      const parts = localStorage.getItem("yalikedags.debug-position.v1")?.split(",").map(Number);
      const x = parts?.[0]; const y = parts?.[1];
      if (x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)) { return { x, y }; }
    } catch { /* Optional storage. */ }
    const gap = motionNumber("--debug-edge-gap");
    return { x: Math.max(0, innerWidth - this.panel.offsetWidth - gap), y: gap };
  }
  private save(): void {
    if (this.drag === undefined) { return; }
    try { localStorage.setItem("yalikedags.debug-position.v1", `${String(this.drag.x)},${String(this.drag.y)}`); } catch { /* Optional storage. */ }
  }
}
