import { PuppyFaceGeometry } from "./PuppyFaceGeometry.ts";
/** SVG geometry owned by a clip. Restore exact source attributes when playback ends. */
export class AnimatedDagGeometry {
  private readonly face: PuppyFaceGeometry;
  readonly nodes: Map<string, { circle: SVGCircleElement; x: number; y: number; cx: string; cy: string; track: string | null }>;
  private readonly edges: { path: SVGPathElement; d: string }[];
  constructor(svg: SVGSVGElement) {
    this.face = new PuppyFaceGeometry(svg);
    this.nodes = new Map(Array.from(svg.querySelectorAll<SVGCircleElement>("circle.node"), circle => [
      circle.id.replace("puppy-dag-node-", ""),
      { circle, x: circle.cx.baseVal.value, y: circle.cy.baseVal.value, cx: circle.getAttribute("cx") ?? "", cy: circle.getAttribute("cy") ?? "", track: circle.getAttribute("data-clip-track") },
    ]));
    this.edges = Array.from(svg.querySelectorAll<SVGPathElement>("path[data-from][data-to]"), path => ({ path, d: path.getAttribute("d") ?? "" }));
  }
  render(offsets: ReadonlyMap<string, { x: number; y: number }>): void {
    for (const [id, offset] of offsets) {
      const node = this.nodes.get(id); if (node === undefined) { continue; }
      node.circle.setAttribute("data-clip-track", "true");
      node.circle.setAttribute("cx", String(node.x + offset.x));
      node.circle.setAttribute("cy", String(node.y + offset.y));
    }
    this.face.render();
    for (const { path } of this.edges) {
      if (offsets.has(path.dataset["from"] ?? "") || offsets.has(path.dataset["to"] ?? "")) { this.connect(path); }
    }
  }
  restore(): void {
    this.face.restore();
    for (const { circle, cx, cy, track } of this.nodes.values()) {
      circle.setAttribute("cx", cx); circle.setAttribute("cy", cy);
      if (track === null) { circle.removeAttribute("data-clip-track"); } else { circle.setAttribute("data-clip-track", track); }
    }
    for (const { path, d } of this.edges) { path.setAttribute("d", d); }
  }
  private connect(path: SVGPathElement): void {
    const a = this.nodes.get(path.dataset["from"] ?? "")?.circle;
    const b = this.nodes.get(path.dataset["to"] ?? "")?.circle;
    if (a === undefined || b === undefined) { return; }
    const x = b.cx.baseVal.value - a.cx.baseVal.value; const y = b.cy.baseVal.value - a.cy.baseVal.value;
    const length = Math.max(1, Math.hypot(x, y)); const start = (a.r.baseVal.value + 3) / length; const end = (b.r.baseVal.value + 7) / length;
    path.setAttribute("d", `M${String(a.cx.baseVal.value + x * start)},${String(a.cy.baseVal.value + y * start)} L${String(b.cx.baseVal.value - x * end)},${String(b.cy.baseVal.value - y * end)}`);
  }
}
