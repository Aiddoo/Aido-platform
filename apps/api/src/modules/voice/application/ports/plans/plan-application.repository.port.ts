import type { ActionPlanSource } from "@aido/api/vocabulary";

export const PLAN_APPLICATION_REPOSITORY = Symbol("PLAN_APPLICATION_REPOSITORY");

/** 적용 한 번의 멱등 기록. 만든 id와 요청 해시만 두고 사용자 글자는 두지 않는다. */
export interface PlanApplicationRecord {
  readonly userId: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly source: ActionPlanSource;
  readonly todoIds: readonly number[];
  readonly memoId: number | null;
}

export interface PlanApplicationRepositoryPort {
  findByKey(userId: string, idempotencyKey: string): Promise<PlanApplicationRecord | null>;
  insert(record: PlanApplicationRecord): Promise<void>;
  /** 지운 행 수를 돌려준다. */
  deleteCreatedBefore(cutoff: Date): Promise<number>;
}
