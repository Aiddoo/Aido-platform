import type { z } from "zod";

import type { ICacheService } from "#api/platform/cache/interfaces/cache.interface";

import type { PlanResultReplayPort } from "../../../application/ports/plans/plan-result-replay.port.js";

/** 재시도는 몇 분 안에 끝난다. 이 시간이 지나면 잊는다. */
export const PLAN_RESULT_REPLAY_TTL_MS = 10 * 60 * 1000;
/** 힙 384MiB 안에서 결과 하나가 최악 100KB여도 20MB를 넘지 않는 수다. */
export const PLAN_RESULT_REPLAY_MAX_ITEMS = 200;

/**
 * 말한 내용에서 나온 결과라 Redis에 두지 않고 프로세스 메모리에만 잠시 둔다(서버 인스턴스는 하나다).
 * 그래서 CACHE_SERVICE가 아닌 전용 InMemoryCacheAdapter를 받는다.
 */
export class InMemoryPlanResultReplayAdapter<T> implements PlanResultReplayPort<T> {
  constructor(
    private readonly cache: Pick<ICacheService, "get" | "set">,
    private readonly namespace: string,
    private readonly schema: z.ZodType<T>,
  ) {}

  async remember(userId: string, idempotencyKey: string, result: T): Promise<void> {
    await this.cache.set(this.#key(userId, idempotencyKey), result, PLAN_RESULT_REPLAY_TTL_MS);
  }

  async recall(userId: string, idempotencyKey: string): Promise<T | null> {
    return (await this.cache.get(this.#key(userId, idempotencyKey), this.schema)) ?? null;
  }

  #key(userId: string, idempotencyKey: string): string {
    return `${this.namespace}:${userId}:${idempotencyKey}`;
  }
}
