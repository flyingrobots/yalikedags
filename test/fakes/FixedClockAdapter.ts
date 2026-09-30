import type { ClockPort } from "../../src/ports/ClockPort.ts";

/** A clock that always says the same day. The only clock tests are allowed to use. */
export class FixedClockAdapter implements ClockPort {
  constructor(private readonly date: string) {}
  today(): string {
    return this.date;
  }
  now(): string { return `${this.date}T12:00:00.000Z`; }
}
