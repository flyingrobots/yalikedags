import { PuppyMotion } from "./PuppyMotion.ts";
import { DagMotion } from "./DagMotion.ts";

/** The real graph and both mascot placements share the same local motion implementation. */
export class ViewerMotion {
  private readonly scenes: DagMotion[];
  constructor() {
    this.scenes = Array.from(document.querySelectorAll<SVGSVGElement>(".puppy-dag,#graph > svg"), svg => new DagMotion(svg));
    document.querySelectorAll<SVGSVGElement>(".puppy-dag").forEach(svg => { new PuppyMotion(svg); });
    document.addEventListener("yalikedags:themechange", () => { this.scenes.forEach(scene => { scene.center(); }); });
  }
}
