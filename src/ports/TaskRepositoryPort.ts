import type { Task } from "../core/domain/Task.ts";

/** Input port: where tasks come from. Linear, a task-list file, a JSON snapshot, an in-memory fake. */
export interface TaskRepositoryPort {
  /** One human-readable line naming the source, for reports. */
  describe(): string;
  load(): Promise<readonly Task[]>;
}
