import { Task } from "../../core/domain/Task.ts";
import type { Priority, TaskFields, TaskStatus } from "../../core/domain/Task.ts";
import type { TaskRepositoryPort } from "../../ports/TaskRepositoryPort.ts";
import { SNAPSHOT_SCHEMA } from "../output/JsonSnapshotAdapter.ts";

const STATUSES: readonly TaskStatus[] = ["open", "in-progress", "done", "canceled", "unknown"];
const PRIORITIES: readonly Priority[] = [1, 2, 3, 4];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function str(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== "string") {
    throw new Error(`snapshot: field ${k} must be a string`);
  }
  return v;
}

function strList(o: Record<string, unknown>, k: string): string[] {
  const v = o[k];
  if (v === undefined) {
    return [];
  }
  if (!Array.isArray(v) || !v.every((x): x is string => typeof x === "string")) {
    throw new Error(`snapshot: field ${k} must be a list of strings`);
  }
  return v;
}

function num(o: Record<string, unknown>, k: string): number | undefined {
  const v = o[k];
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v !== "number") {
    throw new Error(`snapshot: field ${k} must be a number`);
  }
  return v;
}

function statusOf(o: Record<string, unknown>): TaskStatus | undefined {
  const s = str(o, "status");
  if (s === undefined) {
    return undefined;
  }
  const found = STATUSES.find((x) => x === s);
  if (!found) {
    throw new Error(`snapshot: unknown status ${s}`);
  }
  return found;
}

function priorityOf(o: Record<string, unknown>): Priority | undefined {
  const p = num(o, "priority");
  if (p === undefined) {
    return undefined;
  }
  const found = PRIORITIES.find((x) => x === p);
  if (!found) {
    throw new Error(`snapshot: priority must be 1 to 4, got ${String(p)}`);
  }
  return found;
}

/** `unknown` from JSON.parse becomes a validated Task here and nowhere else. */
export function decodeTask(raw: unknown): Task {
  if (!isRecord(raw)) {
    throw new Error("snapshot: task must be an object");
  }
  const id = str(raw, "id");
  const title = str(raw, "title");
  if (id === undefined || title === undefined) {
    throw new Error("snapshot: task needs id and title");
  }
  const f: TaskFields = { id, title, blockedBy: strList(raw, "blockedBy"), children: strList(raw, "children"), labels: strList(raw, "labels"), resources: strList(raw, "resources") };
  const optional: (keyof TaskFields)[] = ["key", "parent", "assignee", "milestone", "due", "url", "createdAt", "description"];
  for (const k of optional) {
    const v = str(raw, k);
    if (v !== undefined) {
      Object.assign(f, { [k]: v });
    }
  }
  const status = statusOf(raw);
  const priority = priorityOf(raw);
  const effort = num(raw, "effort");
  return new Task({ ...f, ...(status && { status }), ...(priority && { priority }), ...(effort !== undefined && { effort }) });
}

export class JsonSnapshotRepositoryAdapter implements TaskRepositoryPort {
  capturedAt: string | null = null;
  warnings: string[] = [];
  constructor(
    private readonly text: string,
    private readonly name: string,
  ) {}

  describe(): string {
    return `snapshot ${this.name}`;
  }

  load(): Promise<readonly Task[]> {
    const parsed: unknown = JSON.parse(this.text);
    if (!isRecord(parsed) || (parsed["schema"] !== SNAPSHOT_SCHEMA && parsed["schema"] !== "yalikedags/snapshot/1")) {
      return Promise.reject(new Error(`snapshot: expected schema ${SNAPSHOT_SCHEMA}`));
    }
    const capturedAt = str(parsed, "capturedAt");
    this.capturedAt = capturedAt !== undefined && Number.isFinite(Date.parse(capturedAt)) ? capturedAt : null;
    this.warnings = strList(parsed, "warnings");
    const tasks = parsed["tasks"];
    if (!Array.isArray(tasks)) {
      return Promise.reject(new Error("snapshot: tasks must be a list"));
    }
    return Promise.resolve(tasks.map((t: unknown) => decodeTask(t)));
  }
}
