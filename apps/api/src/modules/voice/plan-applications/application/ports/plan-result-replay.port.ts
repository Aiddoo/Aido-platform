import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { ActionPlanReadModel } from "../read-models/action-plan.read-model.js";

/**
 * 응답을 받지 못한 재요청에 돌려줄 결과. 서버는 말한 내용을 저장하지 않으므로 프로세스 메모리에 잠시만 둔다.
 * 재시작하거나 시간이 지나면 없고, 그때 호출자는 같은 행을 다시 열어 추가 차감 없이 다시 만든다.
 */
export interface PlanResultReplay<T> {
  save(userId: UserId, idempotencyKey: string, result: T): Promise<void>;
  find(userId: UserId, idempotencyKey: string): Promise<T | null>;
}

/** `model`은 다시 보낸 응답의 로그에도 남기려고 함께 보관하고, 응답에는 싣지 않는다. */
export interface QuickPlanResult {
  readonly plan: ActionPlanReadModel;
  readonly model: string;
}

export abstract class QuickPlanResultReplayPort implements PlanResultReplay<QuickPlanResult> {
  abstract save(userId: UserId, idempotencyKey: string, result: QuickPlanResult): Promise<void>;
  abstract find(userId: UserId, idempotencyKey: string): Promise<QuickPlanResult | null>;
}
