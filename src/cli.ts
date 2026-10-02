#!/usr/bin/env bun
/**
 * Composition root. The only file that constructs host adapters and wires
 * them into services. Everything it prints goes through `out`/`err` so the
 * commands themselves stay testable.
 */
import { AnalysisService } from "./core/services/AnalysisService.ts";
import type { Analysis } from "./core/services/Analysis.ts";
import type { RendererPort } from "./ports/RendererPort.ts";
import { StructureOnlyAnalysisAdapter } from "./adapters/output/StructureOnlyAnalysisAdapter.ts";
import { JsonSnapshotAdapter } from "./adapters/output/JsonSnapshotAdapter.ts";
import { DotRendererAdapter } from "./adapters/output/DotRendererAdapter.ts";
import { SvgRendererAdapter } from "./adapters/output/SvgRendererAdapter.ts";
import { HtmlRendererAdapter } from "./adapters/output/HtmlRendererAdapter.ts";
import { TextReportRendererAdapter } from "./adapters/output/TextReportRendererAdapter.ts";
import { OfflineHttpAdapter } from "./adapters/http/OfflineHttpAdapter.ts";
import { FetchHttpAdapter } from "./adapters/http/FetchHttpAdapter.ts";
import { SystemClockAdapter } from "./adapters/clock/SystemClockAdapter.ts";
import { EnvSecretsAdapter } from "./adapters/secrets/EnvSecretsAdapter.ts";
import { VaultSecretsAdapter } from "./adapters/secrets/VaultSecretsAdapter.ts";
import { ChainSecretsAdapter } from "./adapters/secrets/ChainSecretsAdapter.ts";
import { LinearTaskRepositoryAdapter } from "./adapters/input/LinearTaskRepositoryAdapter.ts";
import { ViewerRequestHandler } from "./viewer/ViewerRequestHandler.ts";
import { ViewerSession } from "./viewer/ViewerSession.ts";
import { ViewerServerAdapter } from "./viewer/ViewerServerAdapter.ts";
import { Args } from "./cli/Args.ts";
import { ExitCode, exitCodeFor } from "./cli/ExitCode.ts";
import type { ExitCodeValue } from "./cli/ExitCode.ts";
import { SourceResolver } from "./cli/SourceResolver.ts";
import { ReconcileCommands } from "./cli/ReconcileCommands.ts";
import { TaskDagJsonRepositoryAdapter } from "./adapters/input/TaskDagJsonRepositoryAdapter.ts";
import { ResourcePolicy } from "./core/domain/ResourcePolicy.ts";
import type { TaskRepositoryPort } from "./ports/TaskRepositoryPort.ts";

const USAGE = `yalikedags: ya like dags?

usage: yalikedags <command> [--project <name|id> | --tasklist <file> | --snapshot <file> | --dag <file>] [options]

commands
  --offline disables remote sources and outbound HTTP; local file workflows remain available.

  sync      read the source and write a snapshot JSON      --out <file>
  audit     report findings (isolated, redundant, stale, split candidates)   --json  --strict
  frontier  the ready tasks, most urgent first
  render    --format json|dot|svg|html|text (default text)   --out <file>
            html is the viewer as one self-contained offline file
            --redact exports structure only (sync/render): replaces IDs, removes content and provenance
  serve     local viewer on 127.0.0.1                       --port <n> (default 0 = pick one)
  key       --set | --check [--target NAME]   store or check a key in the OS keychain
            (default target LINEAR_API_KEY; --set reads stdin, never argv)

reconciliation (the write path)
  plan      diff a desired graph against a tracker, write a plan document
            --desired <kind:value> --current <kind:value> [--prune] [--groups-as-milestones]
            [--no-estimates] [--no-milestones] [--out <file>] [--json] [--strict]
  apply     perform a plan. Reads it back and reports what landed.
            --plan <file> [--confirm] [--allow-destructive] [--receipt <file>]

  A source is kind:value, one of dag:<file>, tasklist:<file>, snapshot:<file>,
  linear:<project name or UUID>. Without --confirm, apply is a dry run and
  writes nothing. Destructive changes need --prune at plan time AND
  --allow-destructive at apply time.

Only 'apply --confirm' writes anything. Every other command, plan included, is
read-only. The key is read from LINEAR_API_KEY in the environment or from the
OS keychain (@git-stunts/vault, account git-stunts). --key-target NAME uses a
different credential, which is how you point a command at a test workspace
instead of the one LINEAR_API_KEY reaches.
`;

const RENDERERS: Record<string, () => RendererPort> = {
  json: () => new JsonSnapshotAdapter(),
  dot: () => new DotRendererAdapter(),
  svg: () => new SvgRendererAdapter(),
  html: () => new HtmlRendererAdapter(),
  text: () => new TextReportRendererAdapter(),
};

async function emit(text: string, outPath: string | undefined): Promise<void> {
  if (outPath === undefined) {
    process.stdout.write(text);
  } else {
    await Bun.write(outPath, text);
    console.error(`wrote ${outPath}`);
  }
}

async function load(repo: TaskRepositoryPort, analyser: AnalysisService): Promise<Analysis> {
  const tasks = await repo.load();
  if (repo instanceof LinearTaskRepositoryAdapter) {
    for (const w of repo.warnings) {
      console.error(`warning: ${w}`);
    }
  }
  console.error(`loaded ${String(tasks.length)} tasks from ${repo.describe()}`);
  return analyser.analyse(tasks, repo.describe(), { ...(repo.capturedAt !== undefined && { capturedAt: repo.capturedAt }), warnings: repo.warnings ?? [], account: repo.account });
}

async function keyCommand(args: Args, vault: VaultSecretsAdapter): Promise<ExitCodeValue> {
  const target = args.get("target") ?? "LINEAR_API_KEY";
  if (args.has("check")) {
    const present = (await vault.get(target)) !== undefined;
    console.log(present ? `${target} is present in the keychain` : `${target} is not in the keychain`);
    return present ? ExitCode.OK : ExitCode.NO_KEY;
  }
  if (args.has("set")) {
    return setKey(target);
  }
  throw new Error("usage: key --set [--target NAME] | key --check [--target NAME]");
}

/**
 * Reads the secret from stdin so it never appears in argv or shell history.
 * Pipe it in from a shell variable filled by `read -rs`, which also keeps it
 * off the screen: printf '%s' "$K" | yalikedags key --set --target NAME
 */
async function setKey(target: string): Promise<ExitCodeValue> {
  console.error(`Reading ${target} from stdin (Ctrl-D to end if you are typing):`);
  const value = (await new Response(Bun.stdin.stream()).text()).trim();
  if (value.length === 0) {
    throw new Error("usage: no key given on stdin");
  }
  const { default: Vault } = await import("@git-stunts/vault");
  await new Vault({ account: "git-stunts" }).setSecret({ target, value });
  console.log(`stored ${target} in the keychain (account git-stunts), ${String(value.length)} characters`);
  return ExitCode.OK;
}

function auditCommand(a: Analysis, args: Args): ExitCodeValue {
  if (args.has("json")) {
    process.stdout.write(`${JSON.stringify(a.findings.map((f) => ({ kind: f.kind, task: f.task, key: a.dag.has(f.task) ? a.dag.get(f.task).key : f.task, detail: f.detail, wouldKill: f.wouldKill })), null, 2)}\n`);
  } else {
    process.stdout.write(new TextReportRendererAdapter().render(a));
  }
  if (a.findings.some((f) => f.kind === "cycle")) {
    return ExitCode.GRAPH_INVALID;
  }
  return args.has("strict") && a.findings.length > 0 ? ExitCode.FINDINGS : ExitCode.OK;
}

async function serveCommand(args: Args, read: () => Promise<Analysis>): Promise<ExitCodeValue> {
  const live = new ViewerSession(read, args.get("key-target") ?? "LINEAR_API_KEY");
  await live.refresh();
  const handler = new ViewerRequestHandler(() => live.current(), () => live.options(), process.env["YALIKEDAGS_DEV"] === "1");
  const handle = new ViewerServerAdapter(handler, () => live.refresh()).start(Number(args.get("port") ?? "0"));
  console.error(`viewer at ${handle.url}  (127.0.0.1 only; Ctrl-C to stop)`);
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      handle.stop();
      resolve();
    });
  });
  return ExitCode.OK;
}

async function dispatch(args: Args, a: Analysis): Promise<ExitCodeValue> {
  const output = args.has("redact") ? new StructureOnlyAnalysisAdapter().transform(a) : a;
  switch (args.command ?? "") {
    case "sync":
      await emit(new JsonSnapshotAdapter().render(output), args.get("out"));
      return ExitCode.OK;
    case "audit":
      return auditCommand(a, args);
    case "frontier":
      process.stdout.write(`${new TextReportRendererAdapter().render(a).split("\n\n")[1] ?? ""}\n`);
      return ExitCode.OK;
    case "render":
      return renderCommand(output, args);
    default:
      throw new Error(`usage: unknown command ${args.command ?? ""}`);
  }
}

async function renderCommand(a: Analysis, args: Args): Promise<ExitCodeValue> {
  const make = RENDERERS[args.get("format") ?? "text"];
  if (!make) {
    throw new Error(`usage: --format must be one of ${Object.keys(RENDERERS).join(", ")}`);
  }
  await emit(make().render(a), args.get("out"));
  return ExitCode.OK;
}

function buildResolver(args: Args, vault: VaultSecretsAdapter): SourceResolver {
  const keyTarget = args.get("key-target");
  return new SourceResolver({
    http: args.has("offline") ? new OfflineHttpAdapter() : new FetchHttpAdapter(),
    offline: args.has("offline"),
    secrets: new ChainSecretsAdapter([new EnvSecretsAdapter(process.env), vault]),
    readFile: (p: string): Promise<string> => Bun.file(p).text(),
    ...(keyTarget !== undefined && { keyTarget }),
  });
}

function validateRedaction(args: Args): void {
  if (args.has("redact") && !["sync", "render"].includes(args.command ?? "")) {
    throw new Error("usage: --redact is supported only by sync and render");
  }
}

async function main(argv: readonly string[]): Promise<ExitCodeValue> {
  const args = new Args(argv);
  const vault = new VaultSecretsAdapter();
  if (args.command === undefined || args.command === "help" || args.has("help")) {
    process.stdout.write(USAGE);
    return args.command === undefined ? ExitCode.USAGE : ExitCode.OK;
  }
  validateRedaction(args);
  if (args.command === "key") {
    return keyCommand(args, vault);
  }
  const resolver = buildResolver(args, vault);
  const clock = new SystemClockAdapter();
  if (args.command === "plan" || args.command === "apply") {
    const commands = new ReconcileCommands({
      resolver,
      clock,
      io: {
        out: (text: string): void => {
          process.stdout.write(text);
        },
        err: (text: string): void => {
          process.stderr.write(text);
        },
        writeFile: async (path: string, text: string): Promise<void> => {
          await Bun.write(path, text);
        },
      },
    });
    return args.command === "plan" ? commands.plan(args) : commands.apply(args);
  }
  const read = async (): Promise<Analysis> => {
    const repo = await resolver.resolve(args);
    const policy = repo instanceof TaskDagJsonRepositoryAdapter ? repo.policy() : new ResourcePolicy();
    return load(repo, new AnalysisService(clock, policy));
  };
  return args.command === "serve" ? serveCommand(args, read) : dispatch(args, await read());
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = exitCodeFor(error);
  },
);
