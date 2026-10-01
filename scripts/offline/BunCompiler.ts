import { readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";

/** This distribution is Bun-only; vault's optional Deno prompt must not become a runtime dependency. */
export class BunCompiler {
  async compile(root: string, outfile: string): Promise<void> {
    const previous = new Set(await readdir(root));
    try {
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
    } finally {
      for (const file of await readdir(root)) {
        if (!previous.has(file) && /^\.[0-9a-f]+-[0-9a-f]+\.bun-build$/.test(file)) { await unlink(resolve(root, file)); }
      }
    }
  }
}
