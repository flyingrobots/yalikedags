import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ProposalFixture } from "./ProposalFixture.ts";
import { AnalysisService } from "../../src/core/services/AnalysisService.ts";
import { DependencyDiscoveryService } from "../../src/core/services/DependencyDiscoveryService.ts";
import { DependencyProposalService } from "../../src/core/services/DependencyProposalService.ts";
import { DependencyReview } from "../../src/core/domain/DependencyReview.ts";
import { ReviewDecision } from "../../src/core/domain/ReviewDecision.ts";
import { ReviewIdentityAdapter } from "../../src/adapters/review/ReviewIdentityAdapter.ts";
import { PlanJsonCodec } from "../../src/adapters/plan/PlanJsonCodec.ts";
import { ReconcileCommands } from "../../src/cli/ReconcileCommands.ts";
import { SourceResolver } from "../../src/cli/SourceResolver.ts";
import { Args } from "../../src/cli/Args.ts";
import { EnvSecretsAdapter } from "../../src/adapters/secrets/EnvSecretsAdapter.ts";
import { FetchHttpAdapter } from "../../src/adapters/http/FetchHttpAdapter.ts";

const suite = process.env["YALIKEDAGS_PROPOSAL_LIVE"] === "1" ? describe : describe.skip;
suite("isolated live proposal acceptance", () => {
  const fixture = new ProposalFixture();
  beforeAll(async () => { await fixture.provision(); }, 120000);
  afterAll(async () => {
    if (!await fixture.reset()) { return; }
    const restored = await fixture.read();
    expect(restored.find(t => t.id === fixture.id("consumer"))?.blockedBy).toEqual([]);
    expect(restored.find(t => t.id === fixture.id("consumer"))?.description ?? "").toBe("");
  }, 120000);

  test("description discovery through exact CLI apply yields a freshly confirmed relation", async () => {
    // oracle: only this sentinel project's two fixture cards participate; tracker reread must show the accepted relation.
    const initial = await fixture.read();
    const schema = initial.find(t => t.id === fixture.id("schema"));
    if (schema === undefined) { throw new Error("Missing fixture schema"); }
    await fixture.describe(`Requires ${schema.key} output before this can merge.`);
    const repo = fixture.repository();
    const tasks = await repo.load();
    const clock = { today: (): string => "2026-10-02" };
    const analysis = new AnalysisService(clock).analyse(tasks, "Isolated proposal fixture", { account: repo.account, warnings: repo.warnings });
    const candidates = new DependencyDiscoveryService().discover(analysis.dag);
    expect(candidates).toHaveLength(1);
    const candidate = candidates[0];
    if (candidate === undefined) { throw new Error("Missing candidate"); }
    const version = await new ReviewIdentityAdapter().identify(analysis);
    const review = new DependencyReview({ sourceVersion: version, taskIds: tasks.map(t => t.id), basis: "Synthetic fixture schema requirement", exceptions: [], reviewer: "Fixture acceptance", reviewedAt: "2026-10-02T00:00:00Z",
      decisions: [new ReviewDecision({ blocker: candidate.blocker, dependent: candidate.dependent, outcome: "accepted", note: "Consumer requires schema output" })] });
    const plan = new DependencyProposalService().plan(analysis, review, version);
    const files = new Map([["plan.json", new PlanJsonCodec().encode(plan)]]);
    const commands = new ReconcileCommands({ clock, resolver: new SourceResolver({ http: new FetchHttpAdapter(), keyTarget: "YALIKEDAGS_LIVE_KEY",
      secrets: new EnvSecretsAdapter({ YALIKEDAGS_LIVE_KEY: fixture.credentials() }), readFile: (path: string): Promise<string> => Promise.resolve(files.get(path) ?? "") }),
      io: { out: (): void => undefined, err: (): void => undefined, writeFile: (path, value): Promise<void> => { files.set(path, value); return Promise.resolve(); } } });
    expect(await commands.apply(new Args(["apply", "--plan", "plan.json"]))).toBe(0);
    expect((await fixture.read()).find(t => t.id === fixture.id("consumer"))?.blockedBy).toEqual([]);
    expect(await commands.apply(new Args(["apply", "--plan", "plan.json", "--confirm", "--receipt", "receipt.json"]))).toBe(0);
    expect(files.get("receipt.json")).toContain('"complete": true');
    expect((await fixture.read()).find(t => t.id === fixture.id("consumer"))?.blockedBy).toEqual([fixture.id("schema")]);
  }, 120000);
});
