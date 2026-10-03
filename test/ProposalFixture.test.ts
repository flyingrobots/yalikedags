import { expect, test } from "bun:test";
import { ProposalFixture } from "./live/ProposalFixture.ts";

test("cleanup reports an unprovisioned fixture without reading missing endpoints", async () => {
  expect(await new ProposalFixture().reset()).toBe(false);
});

test("existing proposal project must identify the configured team before issue writes", () => {
  expect(() => { ProposalFixture.assertTeam({ teams: { nodes: [{ id: "configured" }] } }, "configured"); }).not.toThrow();
  expect(() => { ProposalFixture.assertTeam({ teams: { nodes: [{ id: "other" }] } }, "configured"); }).toThrow("does not belong to the configured team");
  expect(() => { ProposalFixture.assertTeam({}, "configured"); }).toThrow("refusing writes");
});
