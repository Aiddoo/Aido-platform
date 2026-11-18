import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type {
  ClaimedPushDelivery,
  PushDeliveryClaimRepositoryPort,
} from "../ports/push-delivery-claim.repository.port.js";
import { pushDeliveryRateLimitReservationConflict } from "../push-dispatches.errors.js";

interface MarkPushRateLimitReservedDependencies {
  readonly claims: Pick<PushDeliveryClaimRepositoryPort, "markRateLimitReserved">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly clock: ClockPort;
}

// 빈도 제한을 예약한 발송을 표시해 재시도가 다시 예약하지 않게 한다. 하나라도 놓치면 전부 되돌린다
export class MarkPushRateLimitReservedUseCase {
  readonly #dependencies: MarkPushRateLimitReservedDependencies;

  constructor(dependencies: MarkPushRateLimitReservedDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(claimedDeliveries: readonly ClaimedPushDelivery[]): Promise<Set<number>> {
    if (claimedDeliveries.length === 0) {
      return new Set();
    }
    const reservedAt = this.#dependencies.clock.now();
    const reserved = await this.#dependencies.unitOfWork.run(async () => {
      const reservedDispatchIds = await this.#dependencies.claims.markRateLimitReserved(
        claimedDeliveries.map((claimed) => claimed.fence),
        reservedAt,
      );
      if (reservedDispatchIds.length !== claimedDeliveries.length) {
        const reservedIds = new Set(reservedDispatchIds);
        throw pushDeliveryRateLimitReservationConflict(
          claimedDeliveries
            .map((claimed) => claimed.fence.dispatchId)
            .filter((dispatchId) => !reservedIds.has(dispatchId)),
        );
      }
      return reservedDispatchIds;
    });
    return new Set(reserved);
  }
}
