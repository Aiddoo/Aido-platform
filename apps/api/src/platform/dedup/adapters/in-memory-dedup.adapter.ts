import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { LRUCache } from "lru-cache";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";

import type { IDedupProvider } from "../interfaces/dedup.interface.js";

// 키는 날짜·주·사용자 단위다. 넘치면 가장 오래 안 쓴 Set을 버리고, 그 뒤 중복은 DB unique index가 막는다
export const DEDUP_MAX_ENTRIES = 20_000;

/**
 * 인메모리 중복 방지 어댑터
 *
 * - Set마다 호출자가 준 TTL(밀리초)을 lru-cache가 지키고, 만료 항목은 읽을 때 지운다
 * - 단일 프로세스 환경에서만 유효 (수평 확장 시 Redis 필요)
 */
@Injectable()
export class InMemoryDedupAdapter implements IDedupProvider, OnModuleInit {
  readonly #logger = new Logger(InMemoryDedupAdapter.name);
  readonly #sets = new LRUCache<string, Set<string>>({
    max: DEDUP_MAX_ENTRIES,
    // 만료를 Date.now로 재서 테스트의 가짜 시계(setSystemTime)를 그대로 따른다
    perf: { now: () => Date.now() },
    ttlResolution: 0,
  });

  onModuleInit(): void {
    this.#logger.warn({ event: PlatformLogEvent.DEDUP_SINGLE_INSTANCE, provider: "memory" });
  }

  async filterMembers(setKey: string, members: string[]): Promise<Set<string>> {
    const set = this.#sets.get(setKey);
    if (!set) {
      return new Set();
    }
    return new Set(members.filter((m) => set.has(m)));
  }

  async isMember(setKey: string, member: string): Promise<boolean> {
    return this.#sets.get(setKey)?.has(member) ?? false;
  }

  async addMembers(setKey: string, members: string[], ttlMs: number): Promise<void> {
    if (members.length === 0) {
      return;
    }

    const set = this.#sets.get(setKey) ?? new Set<string>();
    for (const m of members) {
      set.add(m);
    }
    // 다시 넣어 Redis PEXPIRE처럼 TTL을 지금부터 새로 잰다
    this.#sets.set(setKey, set, { ttl: ttlMs });
  }
}
