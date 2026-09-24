import type { HttpPort, HttpResponse } from "../../src/ports/HttpPort.ts";

export interface RecordedRequest {
  url: string;
  headers: Readonly<Record<string, string>>;
  body: string;
}

/** Replays canned responses in order and records every request. Can fail request N on purpose. */
export class RecordingHttpAdapter implements HttpPort {
  readonly requests: RecordedRequest[] = [];
  private readonly queue: HttpResponse[];

  constructor(responses: readonly HttpResponse[]) {
    this.queue = [...responses];
  }

  post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<HttpResponse> {
    this.requests.push({ url, headers, body });
    const next = this.queue.shift();
    if (!next) {
      return Promise.reject(new Error("RecordingHttpAdapter: no response queued"));
    }
    return Promise.resolve(next);
  }
}
