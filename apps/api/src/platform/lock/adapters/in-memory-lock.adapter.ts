import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { LRUCache } from "lru-cache";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";

import { LockProviderPort } from "../lock-provider.port.js";

// 동시에 잡힌 잠금 수의 상한. 웹훅·알림 처리 잠금만 쓰므로 정상 운영에서는 닿지 않는다
export const LOCK_MAX_ENTRIES = 10_000;

interface LockEntry {
  readonly expiresAt: number;
}

/**
 * 인메모리 잠금 어댑터
 *
 * - 잠금마다 호출자가 준 TTL(밀리초)을 lru-cache가 지키고, 만료 항목은 읽거나 가득 찼을 때 지운다
 * - lru-cache는 가득 차면 가장 오래 안 쓴 항목을 내보내 잡힌 잠금을 다른 소유자에게 넘길 수 있다.
 *   그래서 새 키는 상한에 닿기 전에만 넣고, 만료를 지워도 가득하면 획득을 거부한다(포트의 fail-closed 계약)
 * - 단일 프로세스 환경에서만 유효 (수평 확장 시 Redis 잠금 필요)
 */
@Injectable()
export class InMemoryLockAdapter extends LockProviderPort implements OnModuleInit {
  readonly #logger = new Logger(InMemoryLockAdapter.name);
  readonly #locks = new LRUCache<string, LockEntry>({
    max: LOCK_MAX_ENTRIES,
    // 만료를 Date.now로 재서 테스트의 가짜 시계(setSystemTime)를 그대로 따른다
    perf: { now: () => Date.now() },
    ttlResolution: 0,
  });

  onModuleInit(): void {
    this.#logger.warn({ event: PlatformLogEvent.LOCK_SINGLE_INSTANCE, provider: "memory" });
  }

  async acquire(resource: string, ttlMs: number): Promise<(() => Promise<void>) | null> {
    const now = Date.now();
    const existing = this.#locks.get(resource);

    if (existing && now < existing.expiresAt) {
      this.#logger.debug({ event: PlatformLogEvent.LOCK_BUSY, resource });
      return null;
    }

    if (!existing && !this.#hasRoomForNewLock()) {
      this.#logger.warn({
        event: PlatformLogEvent.LOCK_CAPACITY_EXCEEDED,
        resource,
        maxEntries: LOCK_MAX_ENTRIES,
      });
      return null;
    }

    const entry: LockEntry = { expiresAt: now + ttlMs };
    this.#locks.set(resource, entry, { ttl: ttlMs });
    this.#logger.debug({ event: PlatformLogEvent.LOCK_ACQUIRED, resource, ttlMs });

    // TTL 만료 뒤 다른 소유자가 재획득한 잠금은 지우지 않는다 (Redis 어댑터의 compare-and-delete와 동일)
    const release = async (): Promise<void> => {
      if (this.#locks.peek(resource) !== entry) {
        return;
      }
      this.#locks.delete(resource);
      this.#logger.debug({ event: PlatformLogEvent.LOCK_RELEASED, resource });
    };

    return release;
  }

  async isLocked(resource: string): Promise<boolean> {
    const entry = this.#locks.get(resource);

    if (!entry) {
      return false;
    }

    if (Date.now() >= entry.expiresAt) {
      this.#locks.delete(resource);
      return false;
    }

    return true;
  }

  #hasRoomForNewLock(): boolean {
    if (this.#locks.size < LOCK_MAX_ENTRIES) {
      return true;
    }
    this.#locks.purgeStale();
    return this.#locks.size < LOCK_MAX_ENTRIES;
  }
}
