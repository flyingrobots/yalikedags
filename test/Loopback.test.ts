import { expect, test } from "bun:test";
import { ViewerServerAdapter } from "../src/viewer/ViewerServerAdapter.ts";
import { ViewerRequestHandler } from "../src/viewer/ViewerRequestHandler.ts";
import { AnalysisService } from "../src/core/services/AnalysisService.ts";
import { FixedClockAdapter } from "./fakes/FixedClockAdapter.ts";

// oracle: only the server's bound loopback authorities may expose captured data or invoke refresh.
test("[medium] loopback server rejects unexpected request authorities before routing", async () => {
  let refreshes = 0;
  const analysis = new AnalysisService(new FixedClockAdapter("2026-09-30")).analyse([], "Synthetic local viewer");
  const handle = new ViewerServerAdapter(new ViewerRequestHandler(() => analysis), () => { refreshes++; return Promise.resolve(); }).start(0);
  try {
    const { port, origin } = new URL(handle.url);
    for (const host of [`untrusted.invalid:${port}`, "127.0.0.1:1", `127.0.0.1.attacker.invalid:${port}`]) {
      const read = await fetch(`${handle.url}viewer.json`, { headers: { Host: host } });
      expect(read.status).toBe(403);
      const write = await fetch(`${handle.url}refresh`, { method: "POST", headers: { Host: host, Origin: `http://${host}`, "X-Yalikedags-Refresh": "1" } });
      expect(write.status).toBe(403);
    }
    expect(refreshes).toBe(0);
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`]) {
      expect((await fetch(`${handle.url}viewer.json`, { headers: { Host: host } })).status).toBe(200);
    }
    expect((await fetch(`${handle.url}refresh`, { method: "POST", headers: { Origin: "https://example.invalid", "X-Yalikedags-Refresh": "1" } })).status).toBe(403);
    expect((await fetch(`${handle.url}refresh`, { method: "POST", headers: { Origin: origin, "X-Yalikedags-Refresh": "1" } })).status).toBe(200);
    expect(refreshes).toBe(1);
    const unsupported = await fetch(`${handle.url}viewer.json`, { method: "POST" });
    expect(unsupported.status).toBe(405); expect(unsupported.headers.get("Allow")).toBe("GET, HEAD");
    expect((await fetch(`${handle.url}viewer.json`, { method: "HEAD" })).status).toBe(200);
  } finally { handle.stop(); }
}, 2000);
