import { gsap } from "gsap";
import { MotionNode } from "./MotionNode.ts";
import { motionNumber, motionPreference } from "./MotionPolicy.ts";

/** One bounded wave per SVG; distances are measured in screen pixels at emission. */
export class DagMotion {
  private nodes: MotionNode[] = [];
  private wave: gsap.core.Timeline | undefined;
  private ring: SVGCircleElement | undefined;
  private frame = 0;
  constructor(private readonly svg: SVGSVGElement) {
    this.prepare();
    svg.addEventListener("pointerover", event => { if (event.pointerType !== "touch") { this.hover(event); } });
    svg.addEventListener("focusin", event => { this.hover(event); });
    svg.addEventListener("click", event => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => { this.burst(event.clientX, event.clientY); });
    });
    for (const type of ["pointerdown", "pointercancel", "wheel"]) { svg.addEventListener(type, () => { this.stop(); }); }
    svg.addEventListener("yalikedags:clip-start", () => { this.nodes.forEach(node => { node.stop(); }); });
    svg.addEventListener("yalikedags:graph-scene", () => { this.stop(); this.prepare(); });
    motionPreference.addEventListener("change", () => { if (motionPreference.matches) { this.stop(); } });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { this.stop(); } });
  }
  private prepare(): void {
    this.nodes = Array.from(this.svg.querySelectorAll(".node"))
      .filter((node): node is SVGGraphicsElement => node instanceof SVGGraphicsElement).map(node => new MotionNode(node));
  }
  private hover(event: Event): void {
    if (motionPreference.matches || !(event.target instanceof Element)) { return; }
    const target = event.target.closest(".node,.dag-motion-node");
    const node = this.nodes.find(entry => entry.node === target || entry.visual === target || entry.visual.contains(event.target instanceof Node ? event.target : null));
    if (event instanceof PointerEvent && event.relatedTarget instanceof Node && node?.visual.contains(event.relatedTarget)) { return; }
    node?.wiggle();
  }
  center(): void {
    const box = this.svg.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) { this.burst(box.x + box.width / 2, box.y + box.height / 2); }
  }
  burst(x: number, y: number): void {
    this.stop();
    const box = this.svg.getBoundingClientRect(); const matrix = this.svg.getScreenCTM();
    if (motionPreference.matches || matrix === null || box.width === 0 || box.height === 0) { return; }
    const speed = motionNumber("--motion-wave-speed");
    if (speed <= 0) { return; }
    const point = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    const radius = Math.hypot(Math.max(x - box.left, box.right - x), Math.max(y - box.top, box.bottom - y));
    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.classList.add("dag-energy-wave"); ring.setAttribute("aria-hidden", "true");
    ring.setAttribute("cx", String(point.x)); ring.setAttribute("cy", String(point.y)); ring.setAttribute("r", "0");
    this.svg.append(ring); this.ring = ring;
    const pose = { radius: 0, opacity: motionNumber("--motion-wave-opacity") };
    this.wave = gsap.timeline({ onComplete: () => { ring.remove(); this.ring = undefined; this.wave = undefined; } });
    this.wave.to(pose, { radius: radius / Math.max(.01, Math.hypot(matrix.a, matrix.b)), opacity: 0, duration: radius / speed, ease: "none", onUpdate: () => {
      ring.setAttribute("r", String(pose.radius)); ring.style.opacity = String(pose.opacity);
    } }, 0);
    this.arrivals(box, x, y).forEach(({ node, distance }) => {
      this.wave?.call(() => { const rect = node.node.getBoundingClientRect(); node.wiggle({ x: rect.x + rect.width / 2 - x, y: rect.y + rect.height / 2 - y }); }, [], distance / speed);
    });
  }
  private arrivals(box: DOMRect, x: number, y: number): { node: MotionNode; distance: number }[] {
    return this.nodes.map(node => ({ node, rect: node.node.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.right >= box.left && rect.left <= box.right && rect.bottom >= box.top && rect.top <= box.bottom)
      .map(({ node, rect }) => ({ node, distance: Math.hypot(Math.max(rect.left - x, 0, x - rect.right), Math.max(rect.top - y, 0, y - rect.bottom)) }))
      .sort((a, b) => a.distance - b.distance).slice(0, motionNumber("--motion-node-limit"));
  }
  stop(): void {
    cancelAnimationFrame(this.frame); this.wave?.kill(); this.wave = undefined;
    this.ring?.remove(); this.ring = undefined; this.nodes.forEach(node => { node.stop(); });
  }
}
