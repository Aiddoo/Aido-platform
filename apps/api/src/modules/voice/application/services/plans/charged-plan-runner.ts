import { ErrorCode } from "@aido/api/errors";
import type { MeteredFeatureKey } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { MeteredFeatureQuota, QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import type { AiTaskId } from "#api/modules/ai-assistance/ai-assistance-generation.public";
import {
  readFeatureQuotaOrNull,
  withoutChargedClaim,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { PlanResultReplayPort } from "../../ports/plans/plan-result-replay.port.js";

/**
 * 생성 결과에 따른 사용량 처리. CHARGE는 할 일이 있어 횟수를 쓰고, NO_ACTION은 할 일이 없어 결과는 주되 환불하고,
 * EMPTY는 돌려줄 내용이 전혀 없어 환불하고 AI_1302로 답한다.
 */
export type PlanChargeOutcome = "CHARGE" | "NO_ACTION" | "EMPTY";

export interface GeneratedPlan<T> {
  readonly result: T;
  readonly outcome: PlanChargeOutcome;
}

export interface ChargedPlanRequest<T> {
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
  /** 차감한 작업 id. 원장에 남고, 같은 키의 다른 작업을 가린다 */
  readonly reason: AiTaskId;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly replay: PlanResultReplayPort<T>;
  readonly generate: () => Promise<GeneratedPlan<T>>;
}

export interface ChargedPlanResult<T> {
  readonly result: T;
  /** 끝난 뒤에도 횟수가 차감된 상태다. 환불을 마치지 못했으면 true로 답한다 */
  readonly charged: boolean;
  /** 결과를 준 뒤 한도를 읽지 못했으면 null이다. 차감한 결과를 잃지 않으려고 오류로 바꾸지 않는다 */
  readonly featureQuota: MeteredFeatureQuota | null;
}

interface ChargedPlanRunnerDependencies {
  readonly quota: Pick<QuotaLedgerPort, "reserve" | "commit" | "refund" | "read">;
  readonly logger: Pick<ApplicationLogger, "warn">;
}

/** 돈이 드는 계획 생성의 사용량 흐름: 호출 전 예약 → 결과에 따라 확정·환불. 같은 키는 한 번만 차감한다. */
export class ChargedPlanRunner {
  readonly #dependencies: ChargedPlanRunnerDependencies;

  constructor(dependencies: ChargedPlanRunnerDependencies) {
    this.#dependencies = dependencies;
  }

  async run<T>(request: ChargedPlanRequest<T>): Promise<ChargedPlanResult<T>> {
    const { quota } = this.#dependencies;
    const { userId, feature, idempotencyKey, reason, requestHash, replay } = request;
    const reservation = await quota.reserve({
      userId,
      feature,
      idempotencyKey,
      requestHash,
      reason,
    });
    if (reservation.alreadyCommitted) {
      return this.#replay(request);
    }

    let generated: GeneratedPlan<T>;
    try {
      generated = await request.generate();
    } catch (error) {
      const refunded = await quota.refund(reservation, "FAILED");
      throw refunded ? error : withoutChargedClaim(error);
    }
    const { result, outcome } = generated;
    return match(outcome)
      .with("EMPTY", async () => {
        const refunded = await quota.refund(reservation, "NO_ACTION");
        const empty = new ApplicationException(ErrorCode.AI_1302, { charged: false });
        throw refunded ? empty : withoutChargedClaim(empty);
      })
      .with("NO_ACTION", async () => {
        const refunded = await quota.refund(reservation, "NO_ACTION");
        return { result, charged: !refunded, featureQuota: await this.#readQuota(request) };
      })
      .with("CHARGE", async () => {
        // 확정보다 먼저 기억한다. 사이에 온 재요청은 처리 중(AI_1314)이라 결과 없음(AI_1317)을 보지 않는다.
        await replay.remember(userId, idempotencyKey, result);
        await quota.commit(reservation);
        return { result, charged: true, featureQuota: await this.#readQuota(request) };
      })
      .exhaustive();
  }

  async #replay<T>(request: ChargedPlanRequest<T>): Promise<ChargedPlanResult<T>> {
    const { userId, idempotencyKey, replay } = request;
    const featureQuota = await this.#readQuota(request);
    const result = await replay.recall(userId, idempotencyKey);
    if (result == null) {
      throw new ApplicationException(ErrorCode.AI_1317, { charged: false, featureQuota });
    }
    return { result, charged: true, featureQuota };
  }

  #readQuota<T>(request: ChargedPlanRequest<T>): Promise<MeteredFeatureQuota | null> {
    const { userId, feature, reason } = request;
    return readFeatureQuotaOrNull(this.#dependencies, { userId, feature, task: reason });
  }
}
