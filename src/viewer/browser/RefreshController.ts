import { element } from "./Dom.ts";
import type { ViewerState } from "./ViewerState.ts";
import type { Workspace } from "./Workspace.ts";
import type { SessionState } from "./SessionState.ts";

export class RefreshController {
  constructor(state: ViewerState, workspace: Workspace, session: SessionState) {
    const control = element("refresh");
    if (!(control instanceof HTMLButtonElement) || control.disabled) { return; }
    control.addEventListener("click", () => {
      void this.refresh(control, () => { session.save(state, workspace); location.reload(); });
    });
  }

  private notice(message: string): void {
    element("refresh-status").textContent = message;
    const notice = element("viewer-notice");
    notice.textContent = message; notice.hidden = false;
  }

  private async refresh(control: HTMLButtonElement, done: () => void): Promise<void> {
    control.disabled = true;
    this.notice("Reading source…");
    try {
      const response = await fetch("/refresh", { method: "POST", headers: { "X-Yalikedags-Refresh": "1" }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) { throw new Error("refresh failed"); }
      done();
    } catch {
      const capture = document.getElementById("snapshot-capture")?.getAttribute("datetime") ?? "unknown";
      this.notice(`Refresh failed. Retaining the previous snapshot captured ${capture}. Check the server and retry.`);
      control.disabled = false;
    }
  }
}
