import type { ViewerRequestHandler } from "./ViewerRequestHandler.ts";

export interface ServerHandle {
  url: string;
  stop: () => void;
}

/** Bun.serve bound to loopback only. Everything else is in ViewerRequestHandler. */
export class ViewerServerAdapter {
  constructor(private readonly handler: ViewerRequestHandler) {}

  start(port: number): ServerHandle {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port,
      fetch: (req) => {
        const res = this.handler.handle(new URL(req.url).pathname);
        return new Response(res.body, { status: res.status, headers: { "Content-Type": res.contentType, "Cache-Control": "no-store" } });
      },
    });
    return { url: `http://127.0.0.1:${String(server.port)}/`, stop: () => void server.stop(true) };
  }
}
