import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";

import { RedisErrorLogSampler } from "../../redis/redis-error-log-sampler.js";
import { REDIS_COMMAND_CLIENT } from "../../redis/redis.constants.js";
import { type DedupEntry, DedupProviderPort } from "../dedup-provider.port.js";

/**
 * Redis Set 기반 중복 방지 어댑터
 *
 * - SMISMEMBER: 배치 멤버십 확인 (Redis 6.2+, ElastiCache 7.1 지원)
 * - Pipeline(SISMEMBER): 집합이 다른 항목들의 멤버십을 한 번에 확인
 * - Pipeline(SADD + PEXPIRE): 원자적 멤버 추가 + TTL 갱신
 * - 멀티 인스턴스 환경에서 dedup 상태 공유
 * - Redis 장애 시 fail-open (DB unique index가 최종 방어선)
 */
@Injectable()
export class RedisDedupAdapter extends DedupProviderPort {
  readonly #logger = new Logger(RedisDedupAdapter.name);
  readonly #redis: Redis;
  readonly #errorSampler = new RedisErrorLogSampler(this.#logger);

  constructor(@Inject(REDIS_COMMAND_CLIENT) redis: Redis) {
    super();
    this.#redis = redis;
  }

  async filterMembers(setKey: string, members: string[]): Promise<Set<string>> {
    if (members.length === 0) {
      return new Set();
    }

    const key = this.#key(setKey);

    try {
      const results = await this.#redis.smismember(key, ...members);
      return new Set(members.filter((_, i) => results[i] === 1));
    } catch (error) {
      this.#errorSampler.warn("DEDUP_FILTER_MEMBERS", error);
      return new Set();
    }
  }

  async filterEntries<TEntry extends DedupEntry>(entries: readonly TEntry[]): Promise<TEntry[]> {
    if (entries.length === 0) {
      return [];
    }

    try {
      const pipeline = this.#redis.pipeline();
      for (const { setKey, member } of entries) {
        pipeline.sismember(this.#key(setKey), member);
      }
      const results = (await pipeline.exec()) ?? [];
      return entries.filter((_, index) => {
        const [error, isMember] = results[index] ?? [null, 0];
        return error == null && isMember === 1;
      });
    } catch (error) {
      this.#errorSampler.warn("DEDUP_FILTER_ENTRIES", error);
      return [];
    }
  }

  async addMembers(setKey: string, members: string[], ttlMs: number): Promise<void> {
    if (members.length === 0) {
      return;
    }

    const key = this.#key(setKey);

    try {
      const pipeline = this.#redis.pipeline();
      pipeline.sadd(key, ...members);
      pipeline.pexpire(key, ttlMs);
      await pipeline.exec();
    } catch (error) {
      this.#errorSampler.warn("DEDUP_ADD_MEMBERS", error);
    }
  }

  async addEntries(entries: readonly DedupEntry[], ttlMs: number): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      const pipeline = this.#redis.pipeline();
      for (const { setKey, member } of entries) {
        const key = this.#key(setKey);
        pipeline.sadd(key, member);
        pipeline.pexpire(key, ttlMs);
      }
      await pipeline.exec();
    } catch (error) {
      this.#errorSampler.warn("DEDUP_ADD_ENTRIES", error);
    }
  }

  #key(setKey: string): string {
    return setKey;
  }
}
