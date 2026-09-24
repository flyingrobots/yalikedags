import { Dag } from "../domain/Dag.ts";
import type { Task } from "../domain/Task.ts";
import { ResourcePolicy } from "../domain/ResourcePolicy.ts";
import type { ClockPort } from "../../ports/ClockPort.ts";
import { Analysis } from "./Analysis.ts";
import { StateService } from "./StateService.ts";
import { FrontierService } from "./FrontierService.ts";
import { WavesService } from "./WavesService.ts";
import { CriticalPathService } from "./CriticalPathService.ts";
import { AuditService } from "./AuditService.ts";

/** Composition of the graph services. The one place they are all called. */
export class AnalysisService {
  private readonly state = new StateService();
  private readonly frontier: FrontierService;
  private readonly waves = new WavesService();
  private readonly critical = new CriticalPathService();
  private readonly audit = new AuditService();

  constructor(
    private readonly clock: ClockPort,
    private readonly policy: ResourcePolicy = new ResourcePolicy(),
  ) {
    this.frontier = new FrontierService(clock);
  }

  analyse(tasks: readonly Task[], source: string): Analysis {
    const dag = new Dag(tasks);
    return new Analysis({
      dag,
      source,
      asOf: this.clock.today(),
      states: this.state.states(dag),
      frontier: this.frontier.frontier(dag),
      conflicts: this.frontier.resourceConflicts(dag, this.policy),
      waves: this.waves.waves(dag),
      gatekeepers: this.waves.gatekeepers(dag),
      workstreams: this.waves.workstreams(dag),
      criticalByDepth: this.critical.byDepth(dag),
      criticalByEffort: this.critical.byEffort(dag),
      findings: this.audit.audit(dag),
    });
  }
}
