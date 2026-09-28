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

  private async refresh(control: HTMLButtonElement, done: () => void): Promise<void> {
    control.disabled = true;
    element("refresh-status").textContent = "Reading source…";
    try {
      const response = await fetch("/refresh", { method: "POST", headers: { "X-Yalikedags-Refresh": "1" }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) { throw new Error("refresh failed"); }
      done();
    } catch {
      element("refresh-status").textContent = "Refresh failed. The previous snapshot is still displayed; check the server and retry.";
      control.disabled = false;
    }
  }
}
