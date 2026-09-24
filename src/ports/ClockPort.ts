/** The only way core code learns what day it is. Tests inject a fixed date. */
export interface ClockPort {
  /** Today as an ISO date, YYYY-MM-DD. */
  today(): string;
}
