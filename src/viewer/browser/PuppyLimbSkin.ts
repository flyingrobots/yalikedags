import type { AnimatedDagGeometry } from "./AnimatedDagGeometry.ts";
interface Point { x: number; y: number }
const CHAINS = [
  { root: "chest", knee: "frontKnee", end: "frontAnkle", upper: ["frontTop"], lower: ["frontBack"] },
  { root: "shoulder", knee: "farFrontKnee", end: "farFrontHeel", upper: ["farFrontBack"], lower: ["farFrontAnkle", "farFrontWrist"] },
  { root: "hip", knee: "rearKnee", end: "rearAnkle", upper: ["rearTop"], lower: ["rearHock"] },
  { root: "haunch", knee: "farRearKnee", end: "farRearHeel", upper: ["farRearBack"], lower: ["farRearAnkle", "farRearHock"] },
] as const;

/** Two-bone IK joints with bind-space skin offsets. Bone rotation preserves cross-section width. */
export class PuppyLimbSkin {
  constructor(private readonly geometry: AnimatedDagGeometry) {}
  apply(points: Map<string, Point>): void {
    for (const chain of CHAINS) { this.chain(points, chain); }
    this.paw(points, "farRear");
    this.paw(points, "farFront");
  }
  private chain(points: Map<string, Point>, chain: typeof CHAINS[number]): void {
      const root = points.get(chain.root); const knee = points.get(chain.knee); const end = points.get(chain.end);
      const a = this.geometry.nodes.get(chain.root); const b = this.geometry.nodes.get(chain.knee); const c = this.geometry.nodes.get(chain.end);
      if (root === undefined || knee === undefined || end === undefined || a === undefined || b === undefined || c === undefined) { return; }
      if ([chain.root, chain.knee, chain.end].every(id => this.resting(points, id))) { return; }
      const side = Math.sign((b.x - a.x) * -(c.y - a.y) + (b.y - a.y) * (c.x - a.x));
      this.solve([root, knee, end], [Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(c.x - b.x, c.y - b.y)], side);
      for (const id of chain.upper) { this.skin(points, id, [chain.root, chain.knee]); }
      for (const id of chain.lower) { this.skin(points, id, [chain.knee, chain.end]); }
  }
  private resting(points: Map<string, Point>, id: string): boolean {
    const point = points.get(id); const rest = this.geometry.nodes.get(id);
    return point !== undefined && rest !== undefined && Math.hypot(point.x - rest.x, point.y - rest.y) < 1e-8;
  }
  private paw(points: Map<string, Point>, prefix: string): void {
    if (this.resting(points, `${prefix}Toe`) && this.resting(points, `${prefix}Heel`)) { return; }
    const toe = points.get(`${prefix}Toe`); const heel = points.get(`${prefix}Heel`);
    if (toe === undefined || heel === undefined) { return; }
    points.set(`${prefix}Paw`, { x: toe.x - 4, y: Math.max(heel.y, toe.y + 20) });
  }
  private solve(joints: readonly [Point, Point, Point], lengths: readonly [number, number], side: number): void {
    const [root, knee, end] = joints; const [upper, lower] = lengths;
    const dx = end.x - root.x; const dy = end.y - root.y; const distance = Math.max(.001, Math.hypot(dx, dy));
    const reach = Math.min(upper + lower - .001, Math.max(Math.abs(upper - lower) + .001, distance));
    const ux = dx / distance; const uy = dy / distance;
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    knee.x = root.x + ux * along - uy * height * side; knee.y = root.y + uy * along + ux * height * side;
    end.x = root.x + ux * reach; end.y = root.y + uy * reach;
  }
  private skin(points: Map<string, Point>, id: string, bone: readonly [string, string]): void {
    const rest = this.geometry.nodes.get(id); const a = this.geometry.nodes.get(bone[0]); const b = this.geometry.nodes.get(bone[1]);
    const start = points.get(bone[0]); const finish = points.get(bone[1]);
    if (rest === undefined || a === undefined || b === undefined || start === undefined || finish === undefined) { return; }
    const length = Math.hypot(b.x - a.x, b.y - a.y); const ux = (b.x - a.x) / length; const uy = (b.y - a.y) / length;
    const along = (rest.x - a.x) * ux + (rest.y - a.y) * uy;
    const normal = (rest.x - a.x) * -uy + (rest.y - a.y) * ux;
    const angle = Math.atan2(finish.y - start.y, finish.x - start.x);
    const skinned = { x: start.x + Math.cos(angle) * along - Math.sin(angle) * normal, y: start.y + Math.sin(angle) * along + Math.cos(angle) * normal };
    const weight = id === "rearTop" ? .2 : id === "rearHock" ? .65 : 1;
    const frame = points.get(id) ?? skinned;
    points.set(id, { x: frame.x + (skinned.x - frame.x) * weight, y: frame.y + (skinned.y - frame.y) * weight });
  }
}
