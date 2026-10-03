import type { Analysis } from "../core/services/Analysis.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

/** A bounded disclosure identifies the partition universe, shared responsibility and exceptions. */
export class PlanningCoverageMarkup {
  render(a: Analysis): string {
    const p = a.planning;
    const label = (id: string): string => esc(a.dag.get(id).key);
    return `<details id="planning-coverage"><summary>Planning coverage · ${String(p.included.length)} active cards · ${String(p.exceptions.length)} outside waves</summary>
      <p>Captured dependency graph · ${esc(a.capturedAt ?? "capture time unknown")}. Export a snapshot to retain the exact task states and dependencies behind this plan.</p>
      <p>${String(p.shared.length)} shared prerequisites; ${String(p.workstreams.reduce((count, stream) => count + stream.tasks.length, 0))} grouped cards; ${String(p.exceptions.length)} exceptions. Each active card occurs in exactly one category. ${String(p.excluded.length)} completed/canceled cards are excluded. ${String(p.containers.length)} active cards are labeled tracking containers; these counts are not executable PR counts.</p>
      <p>Waves contain no prerequisite-related pairs in the active graph; completed outputs satisfy and end prerequisite paths. They are a layering, not a maximum-antichain optimization or a resource-feasible schedule. Missing dependencies can change the result.</p>
      <p>Workstreams are connected components after removing shared prerequisites. They are temporary analytical groups, not team assignments or independently mergeable deliverables. IDs use the smallest member ID and may change after refresh; selection and filters refer to tasks, not durable group ownership.</p>
      <p>Shared prerequisites: ${p.shared.map(id => `${label(id)} (${esc(a.dag.get(id).assignee ?? "Unassigned")})`).join(", ") || "None"}.</p>
      <p>Exceptions: ${p.exceptions.map(label).join(", ") || "None"}. Unknown/missing/canceled prerequisite evidence or cycles prevent scheduling; task details and Findings retain the reasons.</p>
      <p>Cross-group prerequisites: ${p.crossGroupEdges.map(edge => `${label(edge.blocker)} → ${label(edge.dependent)}`).join("; ") || "None"}.</p></details>`;
  }
}
