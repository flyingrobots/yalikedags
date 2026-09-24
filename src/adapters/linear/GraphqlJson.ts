/**
 * Safe accessors for a GraphQL response, which is `unknown` until something
 * checks it. Every read narrows or returns undefined; nothing casts.
 *
 * These live beside the Linear adapters rather than in core because they are
 * boundary machinery: the domain never sees a shape this loose.
 */
export type Rec = Record<string, unknown>;

export const isRec = (x: unknown): x is Rec => typeof x === "object" && x !== null && !Array.isArray(x);

export const rec = (x: unknown): Rec => (isRec(x) ? x : {});

export const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export const str = (x: unknown): string | undefined => (typeof x === "string" ? x : undefined);

export const num = (x: unknown): number | undefined => (typeof x === "number" ? x : undefined);

/** The `nodes` array of a GraphQL connection, as records. */
export const nodes = (x: unknown): Rec[] => list(rec(x)["nodes"]).map(rec);
