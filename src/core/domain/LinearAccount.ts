/** Public capture provenance, never credentials or an assertion of the reader's identity. */
export class LinearAccount {
  constructor(
    readonly user: { readonly id: string; readonly name: string },
    readonly workspace: { readonly id: string; readonly name: string },
    readonly project: { readonly id: string; readonly name: string },
  ) {
    for (const entry of [user, workspace, project]) {
      if (!entry.id.trim() || !entry.name.trim()) { throw new Error("linear_account: identity and name are required"); }
      Object.freeze(entry);
    }
    Object.freeze(this);
  }
}
