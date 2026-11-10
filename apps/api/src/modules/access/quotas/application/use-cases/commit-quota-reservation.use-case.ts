import { PLAN_CATALOG } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { QuotaChargeId } from "../../domain/quota-charge-id.vo.js";
import type { QuotaChargeRepositoryPort } from "../ports/quota-charge.repository.port.js";
import { QuotaLogEvent } from "../quotas.log-events.js";
import type { QuotaReservation } from "../read-models/quota-reservation.read-model.js";

export interface CommitQuotaReservationDependencies {
  readonly quotaChargeRepository: Pick<QuotaChargeRepositoryPort, "findById" | "saveIfUnchanged">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "error">;
}

/** 결과를 준 예약을 확정한다. 바뀌었으면 true이고 저장 오류는 원래 응답을 막지 않도록 기록하고 삼킨다. */
export class CommitQuotaReservationUseCase {
  readonly #dependencies: CommitQuotaReservationDependencies;

  constructor(dependencies: CommitQuotaReservationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(reservation: QuotaReservation): Promise<boolean> {
    if (reservation.isAlreadyCommitted) {
      return false;
    }
    const { quotaChargeRepository, clock, logger } = this.#dependencies;
    const meter = PLAN_CATALOG[reservation.feature].meter;
    try {
      const charge = await quotaChargeRepository.findById(
        QuotaChargeId.reconstitute(reservation.chargeId),
      );
      if (charge == null) {
        return false;
      }
      const expected = charge.version;
      if (!charge.commit({ attempt: reservation.attempt, now: clock.now() })) {
        return false;
      }
      if (!(await quotaChargeRepository.saveIfUnchanged(charge, expected))) {
        return false;
      }
      logger.log({
        event: QuotaLogEvent.COMMITTED,
        chargeId: charge.id.value,
        meter,
        reason: charge.reason,
      });
      return true;
    } catch (error) {
      logger.error({
        event: QuotaLogEvent.COMMIT_FAILED,
        chargeId: reservation.chargeId,
        meter,
        errorType: toErrorType(error),
      });
      return false;
    }
  }
}
