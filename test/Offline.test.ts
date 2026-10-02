import { expect, test } from "bun:test";
import { OfflineHttpAdapter } from "../src/adapters/http/OfflineHttpAdapter.ts";
import { rejection } from "./fakes/rejection.ts";
import { Args } from "../src/cli/Args.ts";
import { SourceResolver } from "../src/cli/SourceResolver.ts";
import { SourceSpec } from "../src/cli/SourceSpec.ts";
import { RecordingHttpAdapter } from "./fakes/RecordingHttpAdapter.ts";

// oracle: offline refusal occurs before the secret/HTTP boundaries, including plan and apply targets.
test("offline source resolution refuses remote reads and writes without accessing credentials", async () => {
  let secretReads = 0;
  const http = new RecordingHttpAdapter([]);
  const resolver = new SourceResolver({ http, offline: true,
    secrets: { describe: (): string => "test secrets", get: (): Promise<string> => { secretReads++; return Promise.resolve("test-key"); } },
    readFile: (): Promise<string> => Promise.resolve("- [ ] Local task\n"),
  });
  expect((await rejection(resolver.resolve(new Args(["render", "--project", "example-project"])))).message).toContain("offline");
  expect((await rejection(resolver.resolveSpec(SourceSpec.parse("linear:example-project")))).message).toContain("offline");
  expect((await rejection(resolver.resolveWriter(SourceSpec.parse("linear:example-project")))).message).toContain("offline");
  expect(secretReads).toBe(0); expect(http.requests).toHaveLength(0);
  const local = await resolver.resolve(new Args(["render", "--tasklist", "example.txt", "--offline"]));
  expect((await local.load()).map((t) => t.title)).toEqual(["Local task"]);
});

test("offline HTTP boundary refuses outbound requests", async () => {
  expect((await rejection(new OfflineHttpAdapter().post("https://example.invalid", {}, ""))).message).toContain("outbound HTTP is disabled");
});
