import { Dag } from "../domain/Dag.ts";
import type { Mutation } from "../domain/Mutation.ts";

/** Compare cyclic edges, not just SCC membership: a new edge inside an old cycle is still new. */
export class GraphSafetyService {
  project(before: Dag, mutations: readonly Mutation[]): Dag {
    return new Dag(before.tasks.map((task) => mutations.reduce((t, m) => m.projectEdges(t), task)));
  }

  introducedCycle(before: Dag, after: Dag): boolean {
    const previous = this.cyclicEdges(before);
    return [...this.cyclicEdges(after)].some((edge) => !previous.has(edge));
  }

  assertSafe(before: Dag, mutations: readonly Mutation[]): void {
    const after = this.project(before, mutations);
    if (this.introducedCycle(before, after)) {
      const members = after.validate().cycles.flat().map((id) => after.get(id).key).join(", ");
      throw new Error(`plan_would_cycle: these changes would introduce a dependency cycle (${members}); re-plan or allow the reviewed removals`);
    }
  }

  private cyclicEdges(dag: Dag): Set<string> {
    const out = new Set<string>();
    for (const component of dag.validate().cycles) {
      const members = new Set(component);
      for (const id of component) {
        for (const blocker of dag.blockers(id).filter((b) => members.has(b))) {
          out.add(JSON.stringify([blocker, id]));
        }
      }
    }
    return out;
  }
}
