/** Keep the pupil and ear fill attached when a clip moves the head's vertices. */
export class PuppyFaceGeometry {
  private readonly pupil: SVGCircleElement | null;
  private readonly ear: SVGPathElement | null;
  private readonly pupilX: string;
  private readonly pupilY: string;
  private readonly earPath: string;
  private readonly eye: SVGCircleElement | null;
  private readonly dx: number;
  private readonly dy: number;
  constructor(private readonly svg: SVGSVGElement) {
    this.pupil = svg.querySelector(".pupil"); this.ear = svg.querySelector(".ear-fill");
    this.eye = svg.querySelector("#puppy-dag-node-eye");
    this.pupilX = this.pupil?.getAttribute("cx") ?? ""; this.pupilY = this.pupil?.getAttribute("cy") ?? "";
    this.earPath = this.ear?.getAttribute("d") ?? "";
    this.dx = Number(this.pupilX) - Number(this.eye?.getAttribute("cx"));
    this.dy = Number(this.pupilY) - Number(this.eye?.getAttribute("cy"));
  }
  render(): void {
    if (this.eye !== null && this.pupil !== null) {
      this.pupil.setAttribute("cx", String(this.eye.cx.baseVal.value + this.dx));
      this.pupil.setAttribute("cy", String(this.eye.cy.baseVal.value + this.dy));
    }
    const points = ["crown", "earRoot", "earOuter", "earBend", "earTip", "earInner", "earFold"].map(id => {
      const node = this.svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${  id}`);
      return node === null ? "" : `${String(node.cx.baseVal.value)} ${String(node.cy.baseVal.value)}`;
    });
    this.ear?.setAttribute("d", `M${  points.join(" L")  }Z`);
  }
  restore(): void {
    this.pupil?.setAttribute("cx", this.pupilX); this.pupil?.setAttribute("cy", this.pupilY);
    this.ear?.setAttribute("d", this.earPath);
  }
}
