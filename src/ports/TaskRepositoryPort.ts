import type { LinearAccount } from "../core/domain/LinearAccount.ts";
import type { Task } from "../core/domain/Task.ts";

/** Input port: where tasks come from. Linear, a task-list file, a JSON snapshot, an in-memory fake. */
export interface TaskRepositoryPort {
  /** Present on snapshot sources; null means the source did not record its acquisition time. */
  readonly account?: LinearAccount | undefined;
  readonly capturedAt?: string | null;
  readonly warnings?: readonly string[];
  /** One human-readable line naming the source, for reports. */
  describe(): string;
  load(): Promise<readonly Task[]>;
}
