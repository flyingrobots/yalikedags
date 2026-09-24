/**
 * The two write-path commands, kept out of the composition root so they can
 * be driven with fakes.
 *
 * The shape is deliberate: `plan` reads two sources and writes a document;
 * `apply` reads that document and, only when told twice (`--confirm`, and
 * `--allow-destructive` for anything that deletes), performs it. Nothing this
 * tool changes was ever decided in the same breath as being performed.
 */
import { Dag } from "../core/domain/Dag.ts";
import type { Plan } from "../core/domain/Plan.ts";
import { ReconcileService } from "../core/services/ReconcileService.ts";
import type { ReconcileOptions } from "../core/services/ReconcileService.ts";
import { ApplyService } from "../core/services/ApplyService.ts";
import type { ApplyReceipt } from "../core/services/ApplyService.ts";
import { PlanJsonCodec } from "../adapters/plan/PlanJsonCodec.ts";
import { PlanTextAdapter } from "../adapters/output/PlanTextAdapter.ts";
import { DryRunTaskWriterAdapter } from "../adapters/output/DryRunTaskWriterAdapter.ts";
import type { TaskRepositoryPort } from "../ports/TaskRepositoryPort.ts";
import type { ClockPort } from "../ports/ClockPort.ts";
import { ExitCode } from "./ExitCode.ts";
import type { ExitCodeValue } from "./ExitCode.ts";
import { SourceSpec } from "./SourceSpec.ts";
import type { SourceResolver } from "./SourceResolver.ts";
import type { Args } from "./Args.ts";

export interface CommandIo {
  out: (text: string) => void;
  err: (text: string) => void;
  writeFile: (path: string, text: string) => Promise<void>;
}

export interface ReconcileDeps {
  resolver: SourceResolver;
  clock: ClockPort;
  io: CommandIo;
}

export class ReconcileCommands {
  private readonly codec = new PlanJsonCodec();
  private readonly text = new PlanTextAdapter();

  constructor(private readonly deps: ReconcileDeps) {}

  async plan(args: Args): Promise<ExitCodeValue> {
    const desiredSpec = SourceSpec.parse(this.required(args, "desired"));
    const currentSpec = SourceSpec.parse(this.required(args, "current"));
    const groupsAsMilestones = args.has("groups-as-milestones");
    const desired = await this.dagOf(await this.deps.resolver.resolveSpec(desiredSpec, { groupsAsMilestones }));
    const current = await this.dagOf(await this.deps.resolver.resolveSpec(currentSpec));
    const options: ReconcileOptions = {
      prune: args.has("prune"),
      estimates: !args.has("no-estimates"),
      milestones: !args.has("no-milestones"),
    };
    const plan = new ReconcileService(this.deps.clock).plan(
      { desired, current, desiredSource: desiredSpec.toString(), currentSource: currentSpec.toString() },
      options,
    );
    await this.emitPlan(plan, args);
    return args.has("strict") && !plan.isEmpty ? ExitCode.FINDINGS : ExitCode.OK;
  }

  async apply(args: Args): Promise<ExitCodeValue> {
    const plan = this.codec.decode(await this.readPlan(args));
    const spec = this.targetSpec(args, plan);
    const repository = await this.deps.resolver.resolveSpec(spec);
    const before = await this.dagOf(repository);
    const confirmed = args.has("confirm");
    const writer = confirmed
      ? await this.deps.resolver.resolveWriter(spec)
      : new DryRunTaskWriterAdapter(spec.toString());
    const receipt = await new ApplyService().apply({
      plan,
      writer,
      before,
      reread: () => (confirmed ? this.dagOf(repository) : Promise.resolve(before)),
      refuseDestructive: !args.has("allow-destructive"),
      at: this.deps.clock.today(),
    });
    return this.emitReceipt({ receipt, plan, args, confirmed });
  }

  /** The plan records its own target; a different `--current` is a refusal, not an override. */
  private targetSpec(args: Args, plan: Plan): SourceSpec {
    const given = args.get("current");
    if (given !== undefined && given !== plan.currentSource) {
      throw new Error(`plan_mismatch: this plan targets ${plan.currentSource}, not ${given}`);
    }
    return SourceSpec.parse(plan.currentSource);
  }

  private async emitPlan(plan: Plan, args: Args): Promise<void> {
    const body = args.has("json") ? this.codec.encode(plan) : this.text.renderPlan(plan);
    const out = args.get("out");
    if (out === undefined) {
      this.deps.io.out(body);
      return;
    }
    await this.deps.io.writeFile(out, this.codec.encode(plan));
    this.deps.io.err(this.text.renderPlan(plan));
    this.deps.io.err(`wrote ${out}\n`);
  }

  private async emitReceipt(e: { receipt: ApplyReceipt; plan: Plan; args: Args; confirmed: boolean }): Promise<ExitCodeValue> {
    const { receipt, plan, args, confirmed } = e;
    if (!confirmed) {
      this.deps.io.out(this.text.renderPlan(plan));
      this.deps.io.err(`DRY RUN: nothing was written. Re-run with --confirm to perform ${String(plan.mutations.length)} change(s).\n`);
      return ExitCode.OK;
    }
    this.deps.io.out(this.text.renderReceipt(receipt, plan));
    const path = args.get("receipt");
    if (path !== undefined) {
      await this.deps.io.writeFile(path, `${JSON.stringify(receipt.toJSON(), null, 2)}\n`);
      this.deps.io.err(`wrote ${path}\n`);
    }
    return receipt.complete ? ExitCode.OK : ExitCode.APPLY_INCOMPLETE;
  }

  private async readPlan(args: Args): Promise<string> {
    const path = args.get("plan");
    if (path === undefined) {
      throw new Error("usage: apply needs --plan <file> written by the plan command");
    }
    return this.deps.resolver.readText(path);
  }

  private async dagOf(repository: TaskRepositoryPort): Promise<Dag> {
    return new Dag(await repository.load());
  }

  private required(args: Args, name: string): string {
    const v = args.get(name);
    if (v === undefined) {
      throw new Error(`usage: --${name} <kind:value> is required`);
    }
    return v;
  }
}
