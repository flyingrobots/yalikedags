/** Bounded UI diagnostics. Never intercept console arguments, task text, or error payloads. */
export class DebugDiagnostics {
  private readonly lines: string[] = [];
  constructor(private readonly output: HTMLTextAreaElement) {
    document.addEventListener("yalikedags:themechange", () => { this.write("Theme changed"); });
    document.addEventListener("yalikedags:puppy-action", () => {
      const action = document.documentElement.dataset["puppyAction"];
      if (["stand", "sit", "bow", "wag", "tilt", "ears"].includes(action ?? "")) { this.write(`Puppy action: ${action ?? ""}`); }
    });
    window.addEventListener("error", () => { this.write("Browser error; see browser console for details"); });
    window.addEventListener("unhandledrejection", () => { this.write("Unhandled rejection; see browser console for details"); });
  }
  write(message: string): void {
    this.lines.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (this.lines.length > 100) { this.lines.shift(); }
    this.output.value = this.lines.join("\n"); this.output.scrollTop = this.output.scrollHeight;
  }
  clear(): void { this.lines.length = 0; this.output.value = ""; }
}
