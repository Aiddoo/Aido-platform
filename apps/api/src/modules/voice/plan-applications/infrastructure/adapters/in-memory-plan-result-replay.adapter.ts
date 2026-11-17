import type { z } from "zod";

import { InMemoryCacheStore } from "#api/platform/cache/adapters/in-memory-cache.store";
import type { CacheStorePort } from "#api/platform/cache/cache-store.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { PlanResultReplayFactoryPort } from "../../application/ports/plan-result-replay-factory.port.js";
import type { PlanResultReplay } from "../../application/ports/plan-result-replay.port.js";
import {
  PLAN_RESULT_REPLAY_MAX_ITEMS,
  PLAN_RESULT_REPLAY_TTL_MS,
  PlanResultReplayKey,
} from "../cache/plan-result-replay.keyspace.js";

/**
 * 말한 내용에서 나온 결과라 Redis에 두지 않고 프로세스 메모리에만 잠시 둔다(서버 인스턴스는 하나다).
 * 빠른 계획·녹음 정리 재생이 이 저장소 하나를 namespace로 나눠 쓴다.
 */
class PlanResultReplayCache extends InMemoryCacheStore {
  constructor() {
    super({ defaultTtlMs: PLAN_RESULT_REPLAY_TTL_MS, maxItems: PLAN_RESULT_REPLAY_MAX_ITEMS });
  }
}

class InMemoryPlanResultReplayAdapter<T> implements PlanResultReplay<T> {
  readonly #cache: Pick<CacheStorePort, "get" | "set">;
  readonly #namespace: string;
  readonly #schema: z.ZodType<T>;

  constructor(cache: Pick<CacheStorePort, "get" | "set">, namespace: string, schema: z.ZodType<T>) {
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
    return PlanResultReplayKey.result(this.#namespace, userId.value, idempotencyKey);
  }
}

export class InMemoryPlanResultReplayFactoryAdapter extends PlanResultReplayFactoryPort {
  readonly #cache = new PlanResultReplayCache();

  forNamespace<TResult>(namespace: string, schema: z.ZodType<TResult>): PlanResultReplay<TResult> {
    return new InMemoryPlanResultReplayAdapter(this.#cache, namespace, schema);
  }
}
