import type { z } from "zod";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import type { ICacheService } from "#api/platform/cache/interfaces/cache.interface";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PlanResultReplay } from "../../application/ports/plan-result-replay.port.js";

/** 재시도는 몇 분 안에 끝난다. 이 시간이 지나면 잊는다. */
const PLAN_RESULT_REPLAY_TTL_MS = 10 * 60 * 1000;
/** 힙 384MiB 안에서 결과 하나가 최악 100KB여도 20MB를 넘지 않는 수다. */
const PLAN_RESULT_REPLAY_MAX_ITEMS = 200;

/**
 * 말한 내용에서 나온 결과라 Redis에 두지 않고 프로세스 메모리에만 잠시 둔다(서버 인스턴스는 하나다).
 * 빠른 계획·녹음 정리 재생이 이 저장소 하나를 namespace로 나눠 쓴다.
 */
export class PlanResultReplayCache extends InMemoryCacheStore {
  constructor() {
    super({ defaultTtlMs: PLAN_RESULT_REPLAY_TTL_MS, maxItems: PLAN_RESULT_REPLAY_MAX_ITEMS });
  }
}

export class InMemoryPlanResultReplayAdapter<T> implements PlanResultReplay<T> {
  readonly #cache: Pick<ICacheService, "get" | "set">;
  readonly #namespace: string;
  readonly #schema: z.ZodType<T>;

  constructor(cache: Pick<ICacheService, "get" | "set">, namespace: string, schema: z.ZodType<T>) {
    this.#cache = cache;
    this.#namespace = namespace;
    this.#schema = schema;
  }

  async save(userId: UserId, idempotencyKey: string, result: T): Promise<void> {
    await this.#cache.set(this.#key(userId, idempotencyKey), result, PLAN_RESULT_REPLAY_TTL_MS);
  }

  async find(userId: UserId, idempotencyKey: string): Promise<T | null> {
    return (await this.#cache.get(this.#key(userId, idempotencyKey), this.#schema)) ?? null;
  }

  #key(userId: UserId, idempotencyKey: string): string {
    return `${this.#namespace}:${userId.value}:${idempotencyKey}`;
  }
}
