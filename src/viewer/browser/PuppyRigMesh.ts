import { PUPPY_FACES } from "./PuppyRigFaces.ts";

/** A debug skin uses live rig vertices, behind all DAG edges and nodes. */
export class PuppyRigMesh {
  private readonly faces: { polygon: SVGPolygonElement; vertices: SVGCircleElement[] }[] = [];
  constructor(svg: SVGSVGElement) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("puppy-rig-mesh"); group.setAttribute("aria-hidden", "true");
    for (const [region, ...ids] of PUPPY_FACES) {
      const vertices = ids.map(id => svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${id}`))
        .filter((node): node is SVGCircleElement => node !== null);
      if (vertices.length !== 3) { continue; }
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.dataset["rigRegion"] = region; polygon.dataset["rigVertices"] = ids.join(" ");
      group.append(polygon); this.faces.push({ polygon, vertices });
    }
    svg.querySelector(".ear-fill")?.before(group);
    svg.addEventListener("yalikedags:rig-pose", () => { this.update(); });
    this.update();
  }
  private update(): void {
    for (const { polygon, vertices } of this.faces) {
      polygon.setAttribute("points", vertices.map(node => `${String(node.cx.baseVal.value)},${String(node.cy.baseVal.value)}`).join(" "));
    }
  }
}
