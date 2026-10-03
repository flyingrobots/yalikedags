import type { Dag } from "../domain/Dag.ts";
import { DependencyCandidate } from "../domain/DependencyCandidate.ts";
import type { Task } from "../domain/Task.ts";

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

/** Bounded local evidence extraction: explicit issue references, never thematic similarity. */
export class DependencyDiscoveryService {
  discover(dag: Dag): DependencyCandidate[] {
    const keys = new Map<string, Task[]>();
    for (const task of dag.tasks) { keys.set(task.key.toUpperCase(), [...(keys.get(task.key.toUpperCase()) ?? []), task]); }
    const candidates = new Map<string, DependencyCandidate>();
    for (const task of dag.tasks.filter(t => !t.isDone()).sort((a, b) => compare(a.id, b.id))) {
      for (const candidate of this.references(task, keys)) {
        const key = JSON.stringify([candidate.blocker, candidate.dependent]);
        if (candidates.get(key)?.confidence !== "explicit") { candidates.set(key, candidate); }
        if (candidates.size >= 2000) { return this.sorted(candidates); }
      }
    }
    return this.sorted(candidates);
  }

  private sorted(candidates: ReadonlyMap<string, DependencyCandidate>): DependencyCandidate[] {
    return [...candidates.values()].sort((a, b) => compare(a.dependent, b.dependent) || compare(a.blocker, b.blocker));
  }

  private *references(task: Task, keys: ReadonlyMap<string, readonly Task[]>): Generator<DependencyCandidate> {
    for (const line of `${task.title}\n${task.description ?? ""}`.split(/\n|(?<=[.!?])\s+/)) {
      for (const match of line.matchAll(/\b[A-Za-z][A-Za-z0-9_]*-\d+\b/g)) {
        const referenced = keys.get(match[0].toUpperCase()) ?? [];
        const blocker = referenced.length === 1 ? referenced[0] : undefined;
        if (blocker === undefined || blocker.id === task.id || task.blockedBy.includes(blocker.id)) { continue; }
        yield this.candidate(task, blocker, { line, referenceAt: match.index });
      }
    }
  }

  private candidate(dependent: Task, blocker: Task, context: { line: string; referenceAt: number }): DependencyCandidate {
    const before = context.line.slice(0, context.referenceAt);
    // Negation and reverse direction deliberately remain uncertain. Human acceptance always supplies the final rationale.
    const explicit = /\b(?:requires?|depends? on|blocked by|needs?)\s*$/i.test(before.trim()) && !/\b(?:not|no|never|without|unrelated|cannot|[a-z]+n['’]t)\b|\?/i.test(context.line);
    return new DependencyCandidate({ blocker: blocker.id, dependent: dependent.id, evidence: context.line.length > 1024 ? `…${context.line.slice(Math.max(0, context.referenceAt - 256), context.referenceAt + 766)}…` : context.line.trim(), confidence: explicit ? "explicit" : "uncertain" });
  }
}
