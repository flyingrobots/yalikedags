import { resolve } from "node:path";

/** This distribution is Bun-only; vault's optional Deno prompt must not become a runtime dependency. */
export class BunCompiler {
  async compile(root: string, outfile: string): Promise<void> {
    const result = await Bun.build({
      entrypoints: [resolve(root, "src/cli.ts")], target: "bun", env: "disable", compile: { outfile },
      plugins: [{ name: "disable-deno-prompt", setup(build): void {
        build.onResolve({ filter: /^@std\/cli\/prompt\/mod\.ts$/ }, () => ({ path: "prompt", namespace: "deno-only" }));
        build.onLoad({ filter: /.*/, namespace: "deno-only" }, () => ({
          contents: 'export function promptSecret() { throw new Error("Deno prompt is unavailable in a Bun distribution"); }', loader: "js",
        }));
      } }],
    });
    if (!result.success) { throw new AggregateError(result.logs, "Offline compilation failed"); }
  }
}
