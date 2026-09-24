import type { ClockPort } from "../../ports/ClockPort.ts";

/** The wall clock, in the local time zone's calendar date. Only the CLI constructs this. */
export class SystemClockAdapter implements ClockPort {
  today(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
