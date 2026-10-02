import { puppyMarkup } from "./generated/puppy.ts";
import { AppearanceMarkup } from "./AppearanceMarkup.ts";
import type { ViewerSetup } from "./SetupData.ts";
import { escapeXml as esc } from "../adapters/output/SvgRendererAdapter.ts";

/** Client-rendered setup, with no credential input or secret storage in the browser. */
export class SetupMarkup {
  render(setup: ViewerSetup): string {
    const validEnv = /^[A-Za-z_][A-Za-z0-9_]*$/.test(setup.keyTarget);
    const command = validEnv ? `export ${setup.keyTarget}='your-linear-api-key'`
      : `bun src/cli.ts key --set --target ${this.quote(setup.keyTarget)}`;
    const message = setup.reason === "missing" ? "Connect your Linear workspace" : "Linear couldn’t authenticate this key";
    const help = validEnv ? "Set your personal Linear API key in the terminal where you launch yalikedags."
      : "This keychain target is not a valid shell variable name. Store your key in the OS keychain instead; the command reads it from stdin.";
    return `<main class="setup-screen" aria-labelledby="setup-title"><div class="setup-content">
<div class="setup-art">${puppyMarkup}</div><p class="setup-wordmark">yalikedags<span>?</span></p>
<h1 id="setup-title">${message}</h1><p>${setup.reason === "missing" ? "No credential was found in the environment or OS keychain." : "Replace the expired, revoked, or invalid credential and try again."} ${help}</p>
<pre class="setup-command" aria-label="Credential setup command"><code>${esc(command)}</code></pre>
<p>${validEnv ? "Replace the placeholder, stop this server with Ctrl-C, and rerun your serve command in that same terminal. A running process cannot pick up a new shell export." : "After storing the key, stop this server with Ctrl-C and rerun your serve command."}</p>
<details class="setup-alternatives"><summary>Prefer the keychain or a local file?</summary>
<p>Keep the key out of shell history: this command reads it from stdin. Paste your key, then press Ctrl-D.</p>
<pre class="setup-command"><code>${esc(`bun src/cli.ts key --set --target ${this.quote(setup.keyTarget)}`)}</code></pre>
<p>Or stop this server and explore the bundled example without a Linear account:</p>
<pre class="setup-command"><code>bun src/cli.ts serve --tasklist examples/example-tasklist.txt</code></pre></details>
<div class="setup-appearance">${new AppearanceMarkup().render()}</div></div></main>`;
  }
  private quote(value: string): string { return `'${value.replace(/'/g, "'\\''")}'`; }
}
