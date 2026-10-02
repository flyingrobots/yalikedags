import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { BunCompiler } from "./BunCompiler.ts";
import { ThirdPartyNotices } from "./ThirdPartyNotices.ts";
import { rec, str } from "../../src/adapters/linear/GraphqlJson.ts";

/** Host-specific release payload; the destination does not need a package manager or runtime. */
export class OfflinePackage {
  constructor(private readonly root: string) {}

  async build(output: string, runtimeLicense: string): Promise<void> {
    const license = await readFile(runtimeLicense, "utf8");
    if (!license.includes("Bun") || !license.includes("JavaScriptCore")) { throw new Error("Supply this Bun distribution's complete LICENSE.md, including runtime notices"); }
    const dependencies = await new ThirdPartyNotices().collect(this.root);
    await mkdir(resolve(output, ".."), { recursive: true });
    await mkdir(output); // Refuse to overwrite an existing release directory.
    const executable = process.platform === "win32" ? "yalikedags.exe" : "yalikedags";
    await new BunCompiler().compile(this.root, join(output, executable));
    for (const name of ["LICENSE", "NOTICE", "bun.lock"]) { await copyFile(join(this.root, name), join(output, name)); }
    await copyFile(join(this.root, "examples/example-tasklist.txt"), join(output, "example-tasklist.txt"));
    await copyFile(join(this.root, "docs/how-to/install-offline.md"), join(output, "INSTALL.md"));
    await writeFile(join(output, "BUN-LICENSE.md"), license);
    await writeFile(join(output, "THIRD-PARTY-NOTICES.txt"), dependencies.text);
    await this.sourceArchive(output);
    const metadata: unknown = JSON.parse(await readFile(join(this.root, "package.json"), "utf8"));
    await writeFile(join(output, "manifest.json"), JSON.stringify({ version: str(rec(metadata)["version"]),
      platform: process.platform, arch: process.arch, bun: Bun.version,
      revision: (await this.command(["git", "rev-parse", "HEAD"])).trim(),
      dirty: (await this.command(["git", "status", "--porcelain"])).trim().length > 0,
      lockSha256: await this.hash(join(output, "bun.lock")), packages: dependencies.packages }, null, 2));
    const sums: string[] = [];
    for (const file of (await readdir(output)).sort()) { sums.push(`${await this.hash(join(output, file))}  ${file}`); }
    await writeFile(join(output, "SHA256SUMS"), `${sums.join("\n")}\n`);
  }

  private async sourceArchive(output: string): Promise<void> {
    const files = await this.command(["git", "ls-files", "-z"]);
    const archive = Bun.spawn(["tar", "-czf", join(output, "source.tar.gz"), "--null", "-T", "-"], { cwd: this.root, stdin: new Blob([files]), stdout: "pipe", stderr: "pipe" });
    const error = await new Response(archive.stderr).text();
    if (await archive.exited !== 0) { throw new Error(`Source archive failed: ${error}`); }
  }
  private async hash(path: string): Promise<string> { return createHash("sha256").update(await readFile(path)).digest("hex"); }
  private async command(args: string[]): Promise<string> {
    const child = Bun.spawn(args, { cwd: this.root, stdout: "pipe", stderr: "pipe" });
    const [out, error] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    if (await child.exited !== 0) { throw new Error(`Release command failed: ${error}`); }
    return out;
  }
}
