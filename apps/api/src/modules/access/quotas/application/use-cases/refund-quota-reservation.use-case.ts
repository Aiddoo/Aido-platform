import { PLAN_CATALOG } from "@aido/api/vocabulary";

import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { QuotaChargeId } from "../../domain/quota-charge-id.vo.js";
import type { QuotaCharge } from "../../domain/quota-charge.aggregate.js";
import type { QuotaRefundReason } from "../../domain/quotas.constants.js";
import type { QuotaChargeRepositoryPort } from "../ports/quota-charge.repository.port.js";
import type { QuotaUsageRepositoryPort } from "../ports/quota-usage.repository.port.js";
import { QuotaLogEvent } from "../quotas.log-events.js";
import type { QuotaReservation } from "../read-models/quota-reservation.read-model.js";

export interface RefundQuotaReservationCommand {
  readonly reservation: QuotaReservation;
  readonly reason: QuotaRefundReason;
}

export interface LockedRefundDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly quotaChargeRepository: Pick<QuotaChargeRepositoryPort, "findById" | "saveIfUnchanged">;
  readonly quotaUsageRepository: Pick<QuotaUsageRepositoryPort, "subtractUsage">;
  readonly clock: ClockPort;
}

/**
 * 사용자 행을 잠그고 최신 차감에 환불 전이를 적용한다. 전이가 실제로 저장되면 그 기간 사용량을 되돌린다.
 * 사용자가 없거나 전이·저장이 지면 false다. 멈춘 예약 정리도 같은 순서를 쓴다.
 */
export function refundChargeUnderUserLock(
  dependencies: LockedRefundDependencies,
  target: { readonly userId: UserId; readonly chargeId: QuotaChargeId },
  transition: (charge: QuotaCharge, now: Temporal.Instant) => boolean,
): Promise<boolean> {
  const { unitOfWork, userMutationLock, quotaChargeRepository, quotaUsageRepository, clock } =
    dependencies;
  return unitOfWork.run(async () => {
    if (!(await userMutationLock.lockById(target.userId))) {
      return false;
    }
    const charge = await quotaChargeRepository.findById(target.chargeId);
    if (charge == null) {
      return false;
    }
    // 잠금을 기다린 뒤의 시각으로 판단한다. 이어받을 만큼 오래됐는지도 이 시각 기준이다
    const now = clock.now();
    const expected = charge.version;
    if (
      !transition(charge, now) ||
      !(await quotaChargeRepository.saveIfUnchanged(charge, expected))
    ) {
      return false;
    }
    await quotaUsageRepository.subtractUsage({
      userId: target.userId,
      meter: charge.meter,
      periodKey: charge.periodKey,
      amount: charge.amount,
      now,
    });
    return true;
  });
}

export interface RefundQuotaReservationDependencies extends LockedRefundDependencies {
  readonly logger: Pick<ApplicationLoggerPort, "log" | "error">;
}

/** 실패·빈 결과의 예약을 정확히 한 번 돌려준다. 오류는 원래 요청 오류를 덮지 않도록 기록하고 false를 준다. */
export class RefundQuotaReservationUseCase {
  readonly #dependencies: RefundQuotaReservationDependencies;

  constructor(dependencies: RefundQuotaReservationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: RefundQuotaReservationCommand): Promise<boolean> {
    const { reservation, reason } = command;
    if (reservation.isAlreadyCommitted) {
      return false;
    }
    const { logger } = this.#dependencies;
    const meter = PLAN_CATALOG[reservation.feature].meter;
    try {
      const refunded = await refundChargeUnderUserLock(
        this.#dependencies,
        {
          userId: UserId.reconstitute(reservation.userId),
          chargeId: QuotaChargeId.reconstitute(reservation.chargeId),
        },
        (charge, now) => charge.refund({ attempt: reservation.attempt, reason, now }),
      );
      if (refunded) {
        logger.log({
          event: QuotaLogEvent.REFUNDED,
          chargeId: reservation.chargeId,
          meter,
          reason,
        });
      }
      return refunded;
    } catch (error) {
      logger.error({
        event: QuotaLogEvent.REFUND_FAILED,
        chargeId: reservation.chargeId,
        meter,
        errorType: toErrorType(error),
      });
      return false;
    }
  }
}
