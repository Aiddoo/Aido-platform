import type { PlanResultReplay } from "#api/modules/voice/action-plans/application/ports/plan-result-replay.port";

// 프로세스 메모리 재생 저장소처럼 결과를 사용자·키로 기억한다. 비우면 "결과를 잃은" 재요청을 흉내 낸다
export class InMemoryPlanResultReplay<T> implements PlanResultReplay<T> {
  readonly results = new Map<string, T>();

  async save(userId: string, idempotencyKey: string, result: T): Promise<void> {
    this.results.set(`${userId}:${idempotencyKey}`, result);
  }

  async find(userId: string, idempotencyKey: string): Promise<T | null> {
    return this.results.get(`${userId}:${idempotencyKey}`) ?? null;
  }
}
