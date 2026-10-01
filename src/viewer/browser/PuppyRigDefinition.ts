/** Disjoint skin ownership, plus the parent joints used by additive motion. */
export const PUPPY_PARTS: Readonly<Record<string, readonly string[]>> = {
    frame: ["neck", "withers", "back", "hip", "rump", "shoulder", "rib", "waist", "haunch", "chest", "belly", "flank"],
    head: ["nose", "bridge", "brow", "forehead", "crown", "eye", "muzzle", "jaw", "cheek"],
    ears: ["earRoot", "earOuter", "earBend", "earTip", "earInner", "earFold"],
    tail: ["tailRoot", "tailBend", "tailTip", "tailOuter", "tailArc", "tailJoin"],
    forelimbs: ["frontKnee", "frontAnkle", "frontToe", "frontPaw", "frontHeel", "frontBack", "frontTop"],
    farForelimb: ["farFrontKnee", "farFrontHeel", "farFrontToe", "farFrontBack", "farFrontAnkle", "farFrontWrist", "farFrontPaw"],
    hindlegs: ["rearKnee", "rearAnkle", "rearToe", "rearPaw", "rearHeel", "rearHock", "rearTop"],
    farHindleg: ["farRearKnee", "farRearToe", "farRearHeel", "farRearBack", "farRearAnkle", "farRearHock", "farRearPaw"],
  };
export const PUPPY_BONES = [
    ["frame", "hip", "withers"], ["frame", "withers", "neck"], ["frame", "shoulder", "chest"],
    ["head", "neck", "eye"], ["head", "eye", "nose"], ["ears", "earRoot", "earTip"],
    ["tail", "hip", "tailRoot"], ["tail", "tailRoot", "tailBend"], ["tail", "tailBend", "tailTip"],
    ["forelimbs", "chest", "frontKnee"], ["forelimbs", "frontKnee", "frontAnkle"], ["forelimbs", "frontAnkle", "frontPaw"],
    ["forelimbs", "shoulder", "farFrontKnee"], ["forelimbs", "farFrontKnee", "farFrontHeel"], ["forelimbs", "farFrontHeel", "farFrontPaw"],
    ["hindlegs", "hip", "rearKnee"], ["hindlegs", "rearKnee", "rearAnkle"], ["hindlegs", "rearAnkle", "rearPaw"],
    ["hindlegs", "haunch", "farRearKnee"], ["hindlegs", "farRearKnee", "farRearHeel"], ["hindlegs", "farRearHeel", "farRearToe"],
  ] as const;
export function rigRegion(part: string): string {
    if (part === "farForelimb") { return "forelimbs"; }
    return part === "farHindleg" ? "hindlegs" : part;
  }
