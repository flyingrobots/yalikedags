import { Dag } from "../domain/Dag.ts";
import type { Mutation } from "../domain/Mutation.ts";

/** Compare cyclic edges, not just SCC membership: a new edge inside an old cycle is still new. */
export class GraphSafetyService {
  project(before: Dag, mutations: readonly Mutation[]): Dag {
    return new Dag(before.tasks.map((task) => mutations.reduce((t, m) => m.projectEdges(t), task)));
  }

  introducedCycle(before: Dag, after: Dag): boolean {
    const previous = this.cyclicEdges(before);
    return [...this.cyclicEdges(after).keys()].some((edge) => !previous.has(edge));
  }

  assertSafe(before: Dag, mutations: readonly Mutation[]): void {
    const after = this.project(before, mutations);
    const previous = this.cyclicEdges(before);
    const introduced = [...this.cyclicEdges(after)].filter(([edge]) => !previous.has(edge));
    if (introduced.length > 0) {
      const members = [...new Set(introduced.flatMap(([, ids]) => ids))].sort().map((id) => after.get(id).key).join(", ");
      throw new Error(`plan_would_cycle: these changes would introduce a dependency cycle (${members}); re-plan or allow the reviewed removals`);
    }
  }

  private cyclicEdges(dag: Dag): Map<string, readonly string[]> {
    const out = new Map<string, readonly string[]>();
    for (const component of dag.validate().cycles) {
      const members = new Set(component);
      for (const id of component) {
        for (const blocker of dag.blockers(id).filter((b) => members.has(b))) {
          out.set(JSON.stringify([blocker, id]), [blocker, id]);
        }
      }
    }
    return out;
  }
}
