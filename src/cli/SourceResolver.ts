import type { TaskRepositoryPort } from "../ports/TaskRepositoryPort.ts";
import type { HttpPort } from "../ports/HttpPort.ts";
import type { SecretsPort } from "../ports/SecretsPort.ts";
import { TaskListParserAdapter } from "../adapters/input/TaskListParserAdapter.ts";
import { JsonSnapshotRepositoryAdapter } from "../adapters/input/JsonSnapshotRepositoryAdapter.ts";
import { LinearTaskRepositoryAdapter } from "../adapters/input/LinearTaskRepositoryAdapter.ts";
import { TaskDagJsonRepositoryAdapter } from "../adapters/input/TaskDagJsonRepositoryAdapter.ts";
import { LinearTaskWriterAdapter } from "../adapters/output/LinearTaskWriterAdapter.ts";
import type { TaskWriterPort } from "../ports/TaskWriterPort.ts";
import type { SourceSpec } from "./SourceSpec.ts";
import type { Args } from "./Args.ts";

export const KEY_TARGET = "LINEAR_API_KEY";

export interface SourceDeps {
  http: HttpPort;
  secrets: SecretsPort;
  readFile: (path: string) => Promise<string>;
  /**
   * Which credential to use. Defaults to LINEAR_API_KEY, which is the one
   * pointed at real work, so a command aimed at a test workspace must say so
   * rather than being given the production key by default.
   */
  keyTarget?: string;
  offline?: boolean;
}

/** Exactly one of --project, --tasklist, --snapshot, --dag names where tasks come from. */
export class SourceResolver {
  constructor(private readonly deps: SourceDeps) {}

  async resolve(args: Args): Promise<TaskRepositoryPort> {
    const chosen = ["project", "tasklist", "snapshot", "dag"].filter((f) => args.has(f));
    if (chosen.length !== 1) {
      throw new Error("usage: give exactly one of --project <name|id>, --tasklist <file>, --snapshot <file>, --dag <file>");
    }
    const dag = args.get("dag");
    if (dag !== undefined) {
      return new TaskDagJsonRepositoryAdapter(await this.deps.readFile(dag), dag, { groupsAsMilestones: args.has("groups-as-milestones") });
    }
    const tasklist = args.get("tasklist");
    if (tasklist !== undefined) {
      return new TaskListParserAdapter(await this.deps.readFile(tasklist), tasklist);
    }
    const snapshot = args.get("snapshot");
    if (snapshot !== undefined) {
      return new JsonSnapshotRepositoryAdapter(await this.deps.readFile(snapshot), snapshot);
    }
    const project = args.get("project");
    if (project === undefined) {
      throw new Error("usage: --project needs a value");
    }
    return new LinearTaskRepositoryAdapter(this.deps.http, await this.key(), project);
  }

  /** A `kind:value` spec, for commands that take more than one source. */
  async resolveSpec(spec: SourceSpec, options: { groupsAsMilestones?: boolean } = {}): Promise<TaskRepositoryPort> {
    if (spec.kind === "linear") {
      return new LinearTaskRepositoryAdapter(this.deps.http, await this.key(), spec.value);
    }
    const text = await this.deps.readFile(spec.value);
    if (spec.kind === "dag") {
      return new TaskDagJsonRepositoryAdapter(text, spec.value, options);
    }
    if (spec.kind === "snapshot") {
      return new JsonSnapshotRepositoryAdapter(text, spec.value);
    }
    return new TaskListParserAdapter(text, spec.value);
  }

  /** Only a tracker can be written to; a file source is a plan, not a target. */
  async resolveWriter(spec: SourceSpec): Promise<TaskWriterPort> {
    if (spec.kind !== "linear") {
      throw new Error(`usage: ${spec.kind} is a file source and cannot be written to; the target must be linear:<project>`);
    }
    return new LinearTaskWriterAdapter(this.deps.http, await this.key(), spec.value);
  }

  /** Read a file through the same seam the sources use, so nothing else needs the filesystem. */
  readText(path: string): Promise<string> {
    return this.deps.readFile(path);
  }

  private async key(): Promise<string> {
    if (this.deps.offline === true) { throw new Error("usage: offline mode refuses remote sources and writers before credential access"); }
    const target = this.deps.keyTarget ?? KEY_TARGET;
    const key = await this.deps.secrets.get(target);
    if (key === undefined) {
      throw new Error(`no_key: ${target} was not found in ${this.deps.secrets.describe()}. Store it once: yalikedags key --set --target ${target}`);
    }
    return key;
  }

}
