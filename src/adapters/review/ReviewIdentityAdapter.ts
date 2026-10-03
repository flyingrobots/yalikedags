import type { Analysis } from "../../core/services/Analysis.ts";

/** SHA-256 over canonical prerequisite evidence; capture timestamps and presentation do not invalidate review. */
export class ReviewIdentityAdapter {
  async identify(a: Analysis): Promise<string> {
    const tasks = a.dag.tasks.map(task => ({
      id: task.id, key: task.key, title: task.title, description: task.description ?? "", status: task.status,
      blockedBy: [...task.blockedBy].sort(), parent: task.parent ?? null,
      children: [...task.children].sort(), labels: [...task.labels].sort(),
    })).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    const text = JSON.stringify({ schema: "yalikedags/review-source/2", workspace: a.account?.workspace.id ?? null,
      project: a.account?.project.id ?? null, warnings: [...a.warnings].sort(), tasks });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
  }
}
