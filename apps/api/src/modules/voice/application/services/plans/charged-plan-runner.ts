import type { MeteredFeatureKey } from "@aido/api/vocabulary";

import type { QuotaLedgerPort, QuotaReservation } from "#api/modules/access/access-quota.public";
import type { AiTaskId } from "#api/modules/ai-assistance/ai-assistance-generation.public";
import {
  commitOrWarn,
  readFeatureQuotaOrNull,
  settleChargedGeneration,
  type ChargedGeneration,
  type ChargedGenerationResult,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { PlanResultReplayPort } from "../../ports/plans/plan-result-replay.port.js";

export interface ChargedPlanRequest<T> {
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
  /** 차감한 작업 id. 원장에 남고, 같은 키의 다른 작업을 가린다 */
  readonly reason: AiTaskId;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly replay: PlanResultReplayPort<T>;
  readonly generate: () => Promise<ChargedGeneration<T>>;
}

interface ChargedPlanRunnerDependencies {
  readonly quota: Pick<QuotaLedgerPort, "reserve" | "reopen" | "commit" | "refund" | "read">;
  readonly logger: Pick<ApplicationLogger, "warn">;
}

/** 돈이 드는 계획 생성의 사용량 흐름: 호출 전 예약 → 결과에 따라 확정·환불. 같은 키는 몇 번을 보내도 한 번만 차감한다. */
export class ChargedPlanRunner {
  readonly #dependencies: ChargedPlanRunnerDependencies;

  constructor(dependencies: ChargedPlanRunnerDependencies) {
    this.#dependencies = dependencies;
  }

  async run<T>(request: ChargedPlanRequest<T>): Promise<ChargedGenerationResult<T>> {
    const { quota } = this.#dependencies;
    const { userId, feature, idempotencyKey, reason, requestHash, replay } = request;
    const reservation = await quota.reserve({
      userId,
      feature,
      idempotencyKey,
      requestHash,
      reason,
    });
    // 처음 시도가 아니면 앞선 시도가 만든 결과가 남아 있을 수 있다. 이어받기·재생성 전에 먼저 본다.
    const remembered =
      reservation.alreadyCommitted || reservation.attempt > 1
        ? await replay.recall(userId, idempotencyKey)
        : null;
    if (remembered != null) {
      return this.#returnRemembered(request, reservation, remembered);
    }
    return settleChargedGeneration<T>(this.#dependencies, {
      // 확정했는데 결과를 잃었으면(재시작·10분 경과) 추가 차감 없이 같은 행에서 다시 만든다.
      reservation: reservation.alreadyCommitted ? await quota.reopen(reservation) : reservation,
      userId,
      feature,
      task: reason,
      generate: request.generate,
      // 확정보다 먼저 기억한다. 사이에 온 재요청은 처리 중(AI_1314)이라 결과를 잃은 것으로 보지 않는다.
      beforeCommit: (result) => replay.remember(userId, idempotencyKey, result),
    });
  }

  async #returnRemembered<T>(
    request: ChargedPlanRequest<T>,
    reservation: QuotaReservation,
    result: T,
  ): Promise<ChargedGenerationResult<T>> {
    const { userId, feature, reason } = request;
    const charged =
      reservation.alreadyCommitted ||
      (await commitOrWarn(this.#dependencies, { reservation, task: reason }));
    const featureQuota = await readFeatureQuotaOrNull(this.#dependencies, {
      userId,
      feature,
      task: reason,
    });
    return { result, charged, featureQuota };
  }
}
