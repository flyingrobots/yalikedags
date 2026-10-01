import { gsap } from "gsap";
import { motionDuration, motionPreference } from "./MotionPolicy.ts";

/** SVG coordinates account for letterboxing and docked panel dimensions. */
export class GraphController {
  private initial: DOMRect;
  private drag: { x: number; y: number; moved: boolean } | undefined;
  private suppressClick = false;
  private initialized = false;
  private pan: gsap.core.Tween | undefined;

  constructor(private readonly svg: SVGSVGElement) {
    const v = svg.viewBox.baseVal;
    this.initial = new DOMRect(v.x, v.y, v.width, v.height);
    svg.addEventListener("wheel", (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, this.point(e)); }, { passive: false });
    svg.addEventListener("pointerdown", (e) => { this.start(e); });
    svg.addEventListener("pointermove", (e) => { this.move(e); });
    svg.addEventListener("pointerup", () => { this.suppressClick = this.drag?.moved ?? false; this.drag = undefined; });
    svg.addEventListener("pointercancel", () => { this.drag = undefined; });
    svg.addEventListener("click", (e) => {
      if (this.suppressClick) { e.stopPropagation(); this.suppressClick = false; }
    }, true);
    this.bindNodes();
    motionPreference.addEventListener("change", () => { if (motionPreference.matches) { this.pan?.progress(1); } });
    new ResizeObserver(() => { if (this.initialized && this.svg.clientWidth > 0) { this.resize(); } }).observe(svg);
  }

  private bindNodes(): void {
    this.svg.querySelectorAll(".node").forEach((node) => {
      node.setAttribute("tabindex", "0"); node.setAttribute("role", "button");
      node.setAttribute("aria-label", node.querySelector("title")?.textContent ?? "Task");
    });
  }

  scene(markup: string): void {
    this.pan?.kill();
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
    this.svg.innerHTML = parsed.innerHTML;
    const box = parsed.getAttribute("viewBox") ?? "0 0 500 300";
    this.svg.setAttribute("viewBox", box);
    const v = this.svg.viewBox.baseVal;
    this.initial = new DOMRect(v.x, v.y, v.width, v.height);
    this.bindNodes();
    this.svg.dispatchEvent(new Event("yalikedags:graph-scene"));
  }

  reveal(): void { if (!this.initialized && this.svg.clientWidth > 0) { this.readable(); } }
  viewport(): string { return this.svg.getAttribute("viewBox") ?? ""; }
  restoreViewport(value: string): void { if (value) { this.svg.setAttribute("viewBox", value); this.resize(); } }

  fit(): void {
    this.pan?.kill();
    this.initialized = true;
    const width = Math.max(this.width() / 2, this.fitWidth());
    this.center(new DOMPoint(this.initial.x + this.initial.width / 2, this.initial.y + this.initial.height / 2), width);
  }

  /** Open at a readable scale; Fit all remains available for the complete overview. */
  readable(): void {
    this.pan?.kill();
    this.initialized = true;
    this.center(this.selectedCenter() ?? new DOMPoint(this.initial.width / 2, Math.min(this.initial.height / 2, this.height() / 2)), this.width());
  }

  zoom(factor: number, anchor?: DOMPoint): void {
    this.pan?.kill();
    const v = this.svg.viewBox.baseVal;
    const width = Math.max(this.width() / 2, Math.min(this.maximum(), v.width * factor));
    const ratio = width / v.width;
    const center = anchor ?? new DOMPoint(v.x + v.width / 2, v.y + v.height / 2);
    this.set(new DOMRect(center.x - (center.x - v.x) * ratio, center.y - (center.y - v.y) * ratio, width, v.height * ratio));
  }

  focus(): void {
    const center = this.selectedCenter();
    if (center === undefined || this.svg.clientWidth === 0) { return; }
    this.pan?.kill();
    const v = this.svg.viewBox.baseVal;
    const pose = { x: v.x, y: v.y, width: v.width, height: v.height };
    const width = Math.max(this.width() / 2, Math.min(this.maximum(), v.width));
    const height = width * this.height() / this.width();
    const target = { x: center.x - width / 2, y: center.y - height / 2, width, height };
    const duration = motionDuration("--motion-pan-duration");
    if (duration === 0) { this.set(new DOMRect(target.x, target.y, width, height)); return; }
    this.pan = gsap.to(pose, { ...target, duration, ease: "power2.out", onUpdate: () => { this.set(new DOMRect(pose.x, pose.y, pose.width, pose.height)); } });
  }

  private selectedCenter(): DOMPoint | undefined {
    const node = this.svg.querySelector(".node.selected");
    if (!(node instanceof SVGGraphicsElement)) { return undefined; }
    const shape = node.querySelector("rect");
    const bounds = shape instanceof SVGGraphicsElement ? shape.getBBox() : node.getBBox();
    return new DOMPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2).matrixTransform(node.transform.baseVal.consolidate()?.matrix);
  }
  private width(): number { return this.svg.clientWidth || 500; }
  private height(): number { return this.svg.clientHeight || 300; }
  private fitWidth(): number { return Math.max(this.initial.width, this.initial.height * this.width() / this.height()); }
  private maximum(): number { return Math.max(this.fitWidth(), this.width() * 4); }
  private center(point: DOMPoint, width: number): void {
    const height = this.height() * width / this.width();
    this.set(new DOMRect(point.x - width / 2, point.y - height / 2, width, height));
  }
  private resize(): void {
    const following = this.pan?.isActive() ?? false;
    this.pan?.kill();
    const v = this.svg.viewBox.baseVal;
    this.center(new DOMPoint(v.x + v.width / 2, v.y + v.height / 2), Math.max(this.width() / 2, Math.min(this.maximum(), v.width)));
    if (following) { this.focus(); }
  }

  private point(event: MouseEvent): DOMPoint {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(this.svg.getScreenCTM()?.inverse());
  }

  private start(event: PointerEvent): void {
    this.pan?.kill();
    if (event.button !== 0) { return; }
    this.suppressClick = false;
    this.drag = { x: event.clientX, y: event.clientY, moved: false };
  }

  private move(event: PointerEvent): void {
    // A release outside the SVG can precede pointer capture at the drag threshold.
    if ((event.buttons & 1) === 0) { this.drag = undefined; return; }
    const drag = this.drag;
    if (drag === undefined) { return; }
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) { return; }
    this.svg.setPointerCapture(event.pointerId);
    const matrix = this.svg.getScreenCTM()?.inverse();
    const previous = new DOMPoint(drag.x, drag.y).matrixTransform(matrix);
    const current = this.point(event);
    const v = this.svg.viewBox.baseVal;
    this.set(new DOMRect(v.x + previous.x - current.x, v.y + previous.y - current.y, v.width, v.height));
    this.drag = { x: event.clientX, y: event.clientY, moved: true };
  }

  private set(rect: DOMRect): void {
    this.svg.setAttribute("viewBox", [rect.x, rect.y, rect.width, rect.height].join(" "));
    for (const action of ["zoom-in", "zoom-out"]) {
      const button = document.querySelector(`[data-action="${action}"]`);
      if (button instanceof HTMLButtonElement) { button.disabled = action === "zoom-in" ? rect.width <= this.width() / 2 + .01 : rect.width >= this.maximum() - .01; }
    }
  }
}
