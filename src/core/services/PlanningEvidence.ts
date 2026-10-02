import type { Task } from "../domain/Task.ts";

export type WorkKind = "Tracking container" | "Implementation" | "Research" | "Decision" | "Investigation" | "Needs disposition";

/** Source labels and explicit body declarations classify scope; missing evidence remains unclassified. */
export class PlanningEvidence {
  kind(task: Task): WorkKind {
    const labels = task.labels.map(label => label.toLowerCase());
    const body = task.description ?? "";
    if (labels.some(label => /^(type:)?(epic|container|tracking|tracking-container)$/.test(label)) || /\bPlanning role:\s*tracking container\b/i.test(body)) { return "Tracking container"; }
    if (labels.some(label => /(?:^|:)(research)$/.test(label))) { return "Research"; }
    if (labels.some(label => /(?:^|:)(decision)$/.test(label))) { return "Decision"; }
    if (labels.some(label => /(?:^|:)(spike|investigation)$/.test(label))) { return "Investigation"; }
    if (labels.some(label => /(?:^|:)(feature|bug|refactor|chore|docs|test)$/.test(label))) { return "Implementation"; }
    return "Needs disposition";
  }
  executable(task: Task): boolean { return this.kind(task) === "Implementation"; }
}
