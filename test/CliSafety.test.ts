import { expect, test } from "bun:test";
import { Args } from "../src/cli/Args.ts";

// oracle: specified. False-looking values cannot open write gates, nor can duplicates override review intent.
  test("boolean flags reject values, valued flags require values, and duplicates are errors", () => {
    for (const flag of ["confirm", "allow-destructive", "prune", "strict"]) {
      for (const value of ["false", "true", "0", "1"]) {
        expect(() => new Args(["apply", `--${flag}`, value])).toThrow(/usage/);
        expect(() => new Args(["apply", `--${flag}=${value}`])).toThrow(/usage/);
      }
    }
    expect(() => new Args(["apply", "--plan"])).toThrow(/needs a value/);
    expect(() => new Args(["apply", "--plan", "--confirm"])).toThrow(/needs a value/);
    expect(() => new Args(["apply", "--confirm", "--confirm"])).toThrow(/duplicate/);
    expect(new Args(["apply", "--plan", "p.json", "--confirm"]).has("confirm")).toBe(true);
  });
