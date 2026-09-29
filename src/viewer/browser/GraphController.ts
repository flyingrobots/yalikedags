/** SVG coordinates account for letterboxing and docked panel dimensions. */
export class GraphController {
  private readonly initial: DOMRect;
  private drag: { x: number; y: number; moved: boolean } | undefined;
  private suppressClick = false;

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
    svg.querySelectorAll(".node").forEach((node) => {
      node.setAttribute("tabindex", "0"); node.setAttribute("role", "button");
      node.setAttribute("aria-label", node.querySelector("title")?.textContent ?? "Task");
    });
  }

  fit(): void { this.set(this.initial); }

  /** Open at a readable scale; Fit all remains available for the complete overview. */
  readable(): void {
    const viewportWidth = this.svg.clientWidth || 500;
    const width = Math.min(this.initial.width, Math.max(500, viewportWidth));
    const height = Math.max(300, this.svg.clientHeight) * width / viewportWidth;
    this.set(new DOMRect(0, 0, width, height));
  }

  zoom(factor: number, anchor?: DOMPoint): void {
    const v = this.svg.viewBox.baseVal;
    const width = Math.max(120, Math.min(this.initial.width * 8, v.width * factor));
    const ratio = width / v.width;
    const center = anchor ?? new DOMPoint(v.x + v.width / 2, v.y + v.height / 2);
    this.set(new DOMRect(center.x - (center.x - v.x) * ratio, center.y - (center.y - v.y) * ratio, width, v.height * ratio));
  }

  focus(): void {
    const node = this.svg.querySelector(".node.selected");
    if (!(node instanceof SVGGraphicsElement)) { return; }
    const bounds = node.getBBox();
    const matrix = node.transform.baseVal.consolidate()?.matrix;
    const origin = new DOMPoint(bounds.x, bounds.y).matrixTransform(matrix);
    const width = Math.max(700, this.svg.clientWidth);
    const height = Math.max(300, this.svg.clientHeight) * width / Math.max(1, this.svg.clientWidth);
    this.set(new DOMRect(origin.x + bounds.width / 2 - width / 2, origin.y + bounds.height / 2 - height / 2, width, height));
  }

  private point(event: MouseEvent): DOMPoint {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(this.svg.getScreenCTM()?.inverse());
  }

  private start(event: PointerEvent): void {
    if (event.button !== 0) { return; }
    this.suppressClick = false;
    this.drag = { x: event.clientX, y: event.clientY, moved: false };
  }

  private move(event: PointerEvent): void {
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
  }
}
