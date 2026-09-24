import { Task } from "../../core/domain/Task.ts";
import type { TaskStatus } from "../../core/domain/Task.ts";
import type { TaskRepositoryPort } from "../../ports/TaskRepositoryPort.ts";

const TASK_LINE = /^(\s*)-\s*\[([ x✓/]|WIP|in-progress)\]\s*(.+?)\s*$/;
const DEPENDS = /\s*\((?:depends on|blocked by|requires):\s*([^)]+)\)\s*$/i;
const WIP_TAG = /\s*\[WIP\]\s*$/i;

interface ParsedLine {
  indent: number;
  status: TaskStatus;
  title: string;
  dependsOn: string[];
}

/** A title becomes an id by lowercasing and slugging, so `depends on:` clauses can refer by title. */
export const slug = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function statusOf(mark: string, title: string): TaskStatus {
  if (mark === "x" || mark === "✓") {
    return "done";
  }
  if (mark === "/" || mark.toLowerCase() === "wip" || mark === "in-progress" || WIP_TAG.test(title)) {
    return "in-progress";
  }
  return "open";
}

function parseLine(line: string): ParsedLine | undefined {
  const m = TASK_LINE.exec(line);
  if (!m) {
    return undefined;
  }
  const indent = Math.floor((m[1] ?? "").length / 2);
  let title = m[3] ?? "";
  const dep = DEPENDS.exec(title);
  const dependsOn = dep?.[1] ? dep[1].split(",").map((s) => s.trim()).filter((s) => s.length > 0) : [];
  if (dep) {
    title = title.slice(0, dep.index).trim();
  }
  const status = statusOf(m[2] ?? " ", title);
  title = title.replace(WIP_TAG, "").trim();
  return { indent, status, title, dependsOn };
}

/**
 * Markdown task lists: `- [ ] Title (depends on: Other, Another)`, `[x]` done,
 * `[/]` or `[WIP]` in progress, two-space indentation for parent and child.
 * The Python prototype's format, kept so the bundled examples still load.
 */
export class TaskListParserAdapter implements TaskRepositoryPort {
  constructor(
    private readonly text: string,
    private readonly name: string,
  ) {}

  describe(): string {
    return `task list ${this.name}`;
  }

  load(): Promise<readonly Task[]> {
    const parsed = this.text.split("\n").map(parseLine).filter((p): p is ParsedLine => p !== undefined);
    const children = new Map<string, string[]>();
    const parents = new Map<string, string>();
    const stack: string[] = [];
    for (const p of parsed) {
      const id = slug(p.title);
      stack.length = Math.min(stack.length, p.indent);
      const parent = stack[stack.length - 1];
      if (parent !== undefined) {
        parents.set(id, parent);
        children.set(parent, [...(children.get(parent) ?? []), id]);
      }
      stack.push(id);
    }
    return Promise.resolve(
      parsed.map((p) => {
        const id = slug(p.title);
        const parent = parents.get(id);
        return new Task({
          id,
          title: p.title,
          status: p.status,
          blockedBy: p.dependsOn.map(slug),
          children: children.get(id) ?? [],
          ...(parent === undefined ? {} : { parent }),
        });
      }),
    );
  }
}
