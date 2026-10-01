import { ViewerSecurityPolicy } from "./ViewerSecurityPolicy.ts";
import type { ViewerRequestHandler } from "./ViewerRequestHandler.ts";

export interface ServerHandle {
  url: string;
  stop: () => void;
}

/** Bun.serve bound to loopback only. Everything else is in ViewerRequestHandler. */
export class ViewerServerAdapter {
  constructor(private readonly handler: ViewerRequestHandler, private readonly refresh?: () => Promise<void>) {}

  private async refreshResponse(req: Request): Promise<Response> {
    if (req.method !== "POST") { return new Response("POST required", { status: 405 }); }
    const origin = req.headers.get("origin");
    if (req.headers.get("X-Yalikedags-Refresh") !== "1" || (origin !== null && origin !== new URL(req.url).origin)) {
      return new Response("Same-origin refresh required", { status: 403 });
    }
    if (this.refresh === undefined) { return new Response("Refresh unavailable", { status: 404 }); }
    try { await this.refresh(); return new Response("{}", { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
    catch { return new Response("Source refresh failed; previous snapshot retained", { status: 502 }); }
  }

  start(port: number): ServerHandle {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port,
      fetch: async (req) => {
        const security = new ViewerSecurityPolicy();
        if (new URL(req.url).pathname === "/refresh") { return security.protect(await this.refreshResponse(req)); }
        const res = this.handler.handle(new URL(req.url).pathname);
        return security.protect(new Response(res.body, { status: res.status, headers: { "Content-Type": res.contentType, "Cache-Control": "no-store" } }));
      },
    });
    return { url: `http://127.0.0.1:${String(server.port)}/`, stop: () => void server.stop(true) };
  }
}
