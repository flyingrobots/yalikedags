import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";
import type { SnapshotChange } from "../core/services/SnapshotChangesService.ts";

const GROUPS = [
  ["Added work", ["added"]], ["Removed work", ["removed"]], ["Completed work", ["completed"]],
  ["Status changes", ["status"]], ["Assignments", ["assignment"]],
  ["Dependency changes", ["blocker added", "blocker removed"]],
  ["Critical paths", ["critical chain by depth", "critical chain by effort"]],
] as const;

export class ChangesMarkup {
  render(changes: readonly SnapshotChange[], has: (id: string) => boolean): string {
    const known = new Set<string>(GROUPS.flatMap(([, kinds]) => [...kinds]));
    return [...GROUPS.map(([title, kinds]) => this.group(title, changes.filter((c) => kinds.some((kind) => kind === c.kind)), has)),
      this.group("Other changes", changes.filter((c) => !known.has(c.kind)), has)].join("");
  }
  private group(title: string, changes: readonly SnapshotChange[], has: (id: string) => boolean): string {
    if (!changes.length) { return ""; }
    return `<section class="change-group"><h3>${esc(title)} <span class="count">${String(changes.length)}</span></h3><ul>${changes.map((change) => `<li>${has(change.task) ? `<button data-task="${esc(change.task)}">${esc(change.key)}</button>` : `<strong>${esc(change.key)}</strong>`}<span>${esc(change.kind)}: ${esc(change.detail)}</span></li>`).join("")}</ul></section>`;
  }
}
