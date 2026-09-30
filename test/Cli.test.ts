import { describe, expect, test } from "bun:test";
import { Args, KNOWN_FLAGS } from "../src/cli/Args.ts";
import { ExitCode, exitCodeFor } from "../src/cli/ExitCode.ts";
import { SourceResolver } from "../src/cli/SourceResolver.ts";
import { RecordingHttpAdapter } from "./fakes/RecordingHttpAdapter.ts";
import { EnvSecretsAdapter } from "../src/adapters/secrets/EnvSecretsAdapter.ts";
import { rejection } from "./fakes/rejection.ts";

describe("Args", () => {
  // oracle: specified. --flag value pairs and bare --flag booleans; positional arguments are refused.
  test("parses a command with valued and boolean flags", () => {
    const a = new Args(["render", "--format", "svg", "--strict", "--out", "x.svg"]);
    expect(a.command).toBe("render");
    expect(a.get("format")).toBe("svg");
    expect(a.has("strict")).toBe(true);
    expect(a.get("strict")).toBeUndefined();
  });
  test("refuses a stray positional argument as a usage error", () => {
    expect(() => new Args(["render", "oops"])).toThrow(/usage/);
  });

  /**
   * A mistyped flag is the failure worth refusing: the parser reads
   * `--allow-destructve` as absent, which is the safe-sounding answer to a
   * question the person meant to answer the other way, and the run looks like
   * it obeyed an instruction it never saw.
   */
  test("refuses an unknown flag instead of ignoring it", () => {
    expect(() => new Args(["apply", "--allow-destructve"])).toThrow(/usage: unknown flag --allow-destructve/);
    expect(() => new Args(["plan", "--purne"])).toThrow(/usage: unknown flag/);
  });

  test("suggests the flag that was meant when exactly one is close", () => {
    expect(() => new Args(["apply", "--allow-destructve"])).toThrow(/Did you mean --allow-destructive\?/);
    expect(() => new Args(["plan", "--no-estimtes"])).toThrow(/Did you mean --no-estimates\?/);
  });

  test("stays silent rather than guessing when nothing is close, or when two things are", () => {
    expect(() => new Args(["plan", "--wildly-unrelated"])).toThrow(/unknown flag --wildly-unrelated$/);
    expect(() => new Args(["plan", "--po"], new Set(["port", "post"]))).toThrow(/unknown flag --po$/);
  });

  test("a valued flag whose value looks like a flag is still checked by name", () => {
    expect(() => new Args(["plan", "--desired", "dag:x.json", "--nonsense", "y"])).toThrow(/unknown flag --nonsense/);
  });

  // oracle: invariant. The usage text and the allow-list are two lists of the same thing.
  test("every flag the usage text documents is a flag the parser accepts", async () => {
    const usage = await Bun.file("src/cli.ts").text();
    const documented = [...new Set([...usage.matchAll(/--([a-z][a-z-]+)/g)].map((m) => m[1] ?? ""))];
    expect(documented.length).toBeGreaterThan(10);
    expect(documented.filter((f) => !KNOWN_FLAGS.has(f))).toEqual([]);
  });
});

describe("exitCodeFor", () => {
  test("maps named refusals to their exit codes and everything else to SOURCE_ERROR", () => {
    expect(exitCodeFor(new Error("linear_unauthorized: nope"))).toBe(ExitCode.LINEAR_UNAUTHORIZED);
    expect(exitCodeFor(new Error("linear_project_not_found: 0"))).toBe(ExitCode.LINEAR_PROJECT_NOT_FOUND);
    expect(exitCodeFor(new Error("no_key: x"))).toBe(ExitCode.NO_KEY);
    expect(exitCodeFor(new Error("usage: x"))).toBe(ExitCode.USAGE);
    expect(exitCodeFor(new Error("plan_mismatch: x"))).toBe(ExitCode.PLAN_MISMATCH);
    expect(exitCodeFor(new Error("plan_would_cycle: x"))).toBe(ExitCode.PLAN_WOULD_CYCLE);
    expect(exitCodeFor(new Error("ENOENT"))).toBe(ExitCode.SOURCE_ERROR);
  });
});

describe("SourceResolver", () => {
  const deps = { http: new RecordingHttpAdapter([]), secrets: new EnvSecretsAdapter({}), readFile: (): Promise<string> => Promise.resolve("- [ ] A\n") };
  test("requires exactly one source flag", async () => {
    const r = new SourceResolver(deps);
    expect((await rejection(r.resolve(new Args(["audit"])))).message).toMatch(/exactly one/);
    expect((await rejection(r.resolve(new Args(["audit", "--tasklist", "a", "--project", "b"])))).message).toMatch(/exactly one/);
  });
  test("refuses --project with a named no_key error when no store has the key", async () => {
    expect((await rejection(new SourceResolver(deps).resolve(new Args(["audit", "--project", "Growth"])))).message).toMatch(/^no_key/);
  });
  test("a task list source loads without touching secrets or the network", async () => {
    const repo = await new SourceResolver(deps).resolve(new Args(["audit", "--tasklist", "t.txt"]));
    expect((await repo.load()).map((t) => t.title)).toEqual(["A"]);
    expect(deps.http.requests).toHaveLength(0);
  });
});

describe("cli [medium]", () => {
  // oracle: specified. The CLI over the bundled example emits a schema-valid snapshot and exits 0.
  test("render --format json over the example task list exits 0 with a snapshot", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts", "render", "--tasklist", "examples/example-tasklist.txt", "--format", "json"], { stdout: "pipe", stderr: "pipe", env: { ...process.env, LINEAR_API_KEY: "" } });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    expect(JSON.parse(out)).toMatchObject({ schema: "yalikedags/snapshot/2" });
  });
  // oracle: specified. `render --format html` is the documented way to get the page as a file.
  test("render --format html over the example task list emits one openable page", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts", "render", "--tasklist", "examples/example-tasklist.txt", "--format", "html"], { stdout: "pipe", stderr: "pipe", env: { ...process.env, LINEAR_API_KEY: "" } });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    expect(out.startsWith("<!doctype html>")).toBe(true);
    expect(out).toContain("<svg");
  });
  test("an unknown --format names every format there actually is", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts", "render", "--tasklist", "examples/example-tasklist.txt", "--format", "pdf"], { stdout: "pipe", stderr: "pipe" });
    const err = await new Response(proc.stderr).text();
    expect(await proc.exited).toBe(2);
    for (const format of ["json", "dot", "svg", "html", "text"]) {
      expect(err).toContain(format);
    }
  });
  test("audit --strict over the example exits 1 because the example has findings", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts", "audit", "--tasklist", "examples/example-tasklist.txt", "--strict"], { stdout: "pipe", stderr: "pipe" });
    await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(1);
  });
  test("no command prints usage and exits 2", async () => {
    const proc = Bun.spawn(["bun", "src/cli.ts"], { stdout: "pipe", stderr: "pipe" });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(2);
    expect(out).toContain("usage:");
  });
});
