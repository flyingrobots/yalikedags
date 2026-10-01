import { PuppyRigMesh } from "./PuppyRigMesh.ts";
import { PUPPY_BONES } from "./PuppyRigDefinition.ts";

/** Bone endpoints use the same final skin coordinates as the DAG edges. */
export class PuppyRigDebug {
  private readonly bones: { line: SVGLineElement; from: string; to: string }[] = [];
  constructor(private readonly svg: SVGSVGElement) {
    new PuppyRigMesh(svg);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("puppy-rig-bones"); group.setAttribute("aria-hidden", "true");
    for (const [region, from, to] of PUPPY_BONES) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.classList.add("puppy-rig-bone"); line.dataset["rigRegion"] = region;
      line.dataset["rigFrom"] = from; line.dataset["rigTo"] = to;
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `${region}: ${from} → ${to}`; line.append(title); group.append(line);
      this.bones.push({ line, from, to });
    }
    svg.querySelector("#puppy-dag-nodes")?.parentElement?.append(group);
    svg.addEventListener("yalikedags:rig-pose", () => { this.update(); });
    this.update();
  }
  private update(): void {
    for (const { line, from, to } of this.bones) {
      const a = this.svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${from}`);
      const b = this.svg.querySelector<SVGCircleElement>(`#puppy-dag-node-${to}`);
      if (a === null || b === null) { continue; }
      line.setAttribute("x1", String(a.cx.baseVal.value)); line.setAttribute("y1", String(a.cy.baseVal.value));
      line.setAttribute("x2", String(b.cx.baseVal.value)); line.setAttribute("y2", String(b.cy.baseVal.value));
    }
  }
}
