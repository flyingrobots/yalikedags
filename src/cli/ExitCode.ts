/** Exit codes are part of the CLI contract and are documented in docs/reference/exit-codes.md. */
export const ExitCode = {
  OK: 0,
  FINDINGS: 1,
  USAGE: 2,
  LINEAR_UNAUTHORIZED: 3,
  LINEAR_PROJECT_NOT_FOUND: 4,
  SOURCE_ERROR: 5,
  GRAPH_INVALID: 6,
  NO_KEY: 7,
  APPLY_INCOMPLETE: 8,
  PLAN_MISMATCH: 9,
  PLAN_WOULD_CYCLE: 10,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** Map a refusal's leading `name:` token to an exit code. Unknown refusals are source errors. */
export function exitCodeFor(error: unknown): ExitCodeValue {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("linear_unauthorized")) {
    return ExitCode.LINEAR_UNAUTHORIZED;
  }
  if (message.startsWith("linear_project_not_found")) {
    return ExitCode.LINEAR_PROJECT_NOT_FOUND;
  }
  if (message.startsWith("no_key")) {
    return ExitCode.NO_KEY;
  }
  if (message.startsWith("usage")) {
    return ExitCode.USAGE;
  }
  if (message.startsWith("plan_mismatch")) {
    return ExitCode.PLAN_MISMATCH;
  }
  if (message.startsWith("plan_would_cycle")) {
    return ExitCode.PLAN_WOULD_CYCLE;
  }
  return ExitCode.SOURCE_ERROR;
}
