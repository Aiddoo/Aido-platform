import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";

export class RecordingMutationLock extends MutationLockPort {
  readonly acquiredKeys: string[][] = [];
  // 다른 트랜잭션이 잡고 있는 키다. tryAcquire는 이 키가 하나라도 있으면 false다
  readonly contendedKeys = new Set<string>();

  async acquire(keys: readonly string[]): Promise<void> {
    this.acquiredKeys.push([...keys]);
  }

  async tryAcquire(keys: readonly string[]): Promise<boolean> {
    if (keys.some((key) => this.contendedKeys.has(key))) {
      return false;
    }
    this.acquiredKeys.push([...keys]);
    return true;
  }
}
