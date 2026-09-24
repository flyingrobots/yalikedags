/** Await a promise expected to reject and return the reason; throws if it resolved. */
export async function rejection(p: Promise<unknown>): Promise<Error> {
  const outcome = await p.then(
    () => undefined,
    (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
  );
  if (outcome === undefined) {
    throw new Error("expected the promise to reject, but it resolved");
  }
  return outcome;
}
