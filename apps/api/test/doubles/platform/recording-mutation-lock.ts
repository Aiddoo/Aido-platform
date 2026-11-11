import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";

export class RecordingMutationLock extends MutationLockPort {
  readonly acquiredKeys: string[][] = [];

  async acquire(keys: readonly string[]): Promise<void> {
    this.acquiredKeys.push([...keys]);
  }
}
