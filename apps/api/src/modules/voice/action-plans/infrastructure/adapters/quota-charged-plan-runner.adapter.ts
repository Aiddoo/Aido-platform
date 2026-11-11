import type {
  QuotaLedgerPort,
  QuotaReservation,
} from "#api/modules/access/quotas/access-quotas.public";
import type {
  ChargedGenerationPort,
  ChargedGenerationResult,
} from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";

import {
  type ChargedPlanRequest,
  ChargedPlanRunnerPort,
} from "../../application/ports/charged-plan-runner.port.js";

interface QuotaChargedPlanRunnerDependencies {
  readonly quota: Pick<QuotaLedgerPort, "reserve" | "reopen">;
  readonly chargedGeneration: Pick<ChargedGenerationPort, "settle" | "commit" | "readFeatureQuota">;
}

/** access 사용량 원장에 Idempotency-Key로 예약하고, 앞선 시도의 결과가 남아 있으면 다시 만들지 않고 돌려준다. */
export class QuotaChargedPlanRunnerAdapter extends ChargedPlanRunnerPort {
  readonly #dependencies: QuotaChargedPlanRunnerDependencies;

  constructor(dependencies: QuotaChargedPlanRunnerDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  async run<T>(request: ChargedPlanRequest<T>): Promise<ChargedGenerationResult<T>> {
    const { quota, chargedGeneration } = this.#dependencies;
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
      reservation.isAlreadyCommitted || reservation.attempt > 1
        ? await replay.find(userId, idempotencyKey)
        : null;
    if (remembered != null) {
      return this.#returnRemembered(request, reservation, remembered);
    }
    return chargedGeneration.settle<T>({
      // 확정했는데 결과를 잃었으면(재시작·10분 경과) 추가 차감 없이 같은 행에서 다시 만든다.
      reservation: reservation.isAlreadyCommitted ? await quota.reopen(reservation) : reservation,
      userId,
      feature,
      task: reason,
      generate: request.generate,
      // 확정보다 먼저 기억한다. 사이에 온 재요청은 처리 중(AI_1314)이라 결과를 잃은 것으로 보지 않는다.
      beforeCommit: (result) => replay.save(userId, idempotencyKey, result),
    });
  }

  async #returnRemembered<T>(
    request: ChargedPlanRequest<T>,
    reservation: QuotaReservation,
    result: T,
  ): Promise<ChargedGenerationResult<T>> {
    const { chargedGeneration } = this.#dependencies;
    const { userId, feature, reason } = request;
    const charged =
      reservation.isAlreadyCommitted ||
      (await chargedGeneration.commit({ reservation, task: reason }));
    const featureQuota = await chargedGeneration.readFeatureQuota({
      userId,
      feature,
      task: reason,
    });
    return { result, charged, featureQuota };
  }
}
