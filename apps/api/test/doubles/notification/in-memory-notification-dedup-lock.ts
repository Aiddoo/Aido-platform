import { NotificationDedupLockPort } from "#api/modules/notification/push/application/ports/notification-dedup.port";

// 같은 키는 해제 전까지 한 번만 잡힌다. 잡은 키와 해제한 키를 순서대로 남긴다
export class InMemoryNotificationDedupLock extends NotificationDedupLockPort {
  readonly acquiredKeys: string[] = [];
  readonly releasedKeys: string[] = [];
  readonly #held = new Set<string>();

  get heldKeys(): readonly string[] {
    return [...this.#held];
  }

  hold(dedupKey: string): void {
    this.#held.add(dedupKey);
  }

  async acquire(dedupKey: string): Promise<(() => Promise<void>) | null> {
    if (this.#held.has(dedupKey)) {
      return null;
    }
    this.#held.add(dedupKey);
    this.acquiredKeys.push(dedupKey);
    return async () => {
      this.#held.delete(dedupKey);
      this.releasedKeys.push(dedupKey);
    };
  }
}
