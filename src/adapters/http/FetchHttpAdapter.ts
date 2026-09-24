import type { HttpPort, HttpResponse } from "../../ports/HttpPort.ts";

/** The real network. Only the CLI constructs this; tests use RecordingHttpAdapter. */
export class FetchHttpAdapter implements HttpPort {
  async post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<HttpResponse> {
    const res = await fetch(url, { method: "POST", headers, body });
    return { status: res.status, body: await res.text() };
  }
}
