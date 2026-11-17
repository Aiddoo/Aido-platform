import { MINUTE_MS } from "#api/shared/domain/time/time-units";

// 재시도는 몇 분 안에 끝난다. 이 시간이 지나면 잊는다
export const PLAN_RESULT_REPLAY_TTL_MS = 10 * MINUTE_MS;
// 힙 384MiB 안에서 결과 하나가 최악 100KB여도 20MB를 넘지 않는 수다
export const PLAN_RESULT_REPLAY_MAX_ITEMS = 200;

// 공용 캐시가 아닌 재생 전용 저장소 안의 키라 접두사 없이 흐름 namespace로 나눈다
export const PlanResultReplayKey = {
  result: (namespace: string, userId: string, idempotencyKey: string) =>
    `${namespace}:${userId}:${idempotencyKey}`,
} as const;
