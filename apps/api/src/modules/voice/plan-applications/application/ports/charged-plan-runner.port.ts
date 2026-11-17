import type { MeteredFeatureKey } from "@aido/api/vocabulary";

import type { AiTaskId } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import type {
  ChargedGeneration,
  ChargedGenerationResult,
} from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PlanResultReplay } from "./plan-result-replay.port.js";

export interface ChargedPlanRequest<T> {
  readonly userId: UserId;
  readonly feature: MeteredFeatureKey;
  /** 차감한 작업 id. 원장에 남고, 같은 키의 다른 작업을 가린다 */
  readonly reason: AiTaskId;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly replay: PlanResultReplay<T>;
  readonly generate: () => Promise<ChargedGeneration<T>>;
}

/** 돈이 드는 계획 생성의 사용량 흐름: 호출 전 예약 → 결과에 따라 확정·환불. 같은 키는 몇 번을 보내도 한 번만 차감한다. */
export abstract class ChargedPlanRunnerPort {
  abstract run<T>(request: ChargedPlanRequest<T>): Promise<ChargedGenerationResult<T>>;
}
