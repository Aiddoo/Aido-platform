import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import {
  QUOTA_ABANDONED_REFUND_BATCH_SIZE,
  QUOTA_REQUEST_HASH_RETENTION_MS,
  QUOTA_RESERVATION_TAKEOVER_AFTER_MS,
  QUOTA_STALE_RESERVATION_ALERT_AFTER_MS,
} from "../../domain/quotas.constants.js";
import type { QuotaChargeRepositoryPort } from "../ports/quota-charge.repository.port.js";
import { QuotaAlerts } from "../quotas.alerts.js";
import { QuotaLogEvent } from "../quotas.log-events.js";
import {
  refundChargeUnderUserLock,
  type LockedRefundDependencies,
} from "./refund-quota-reservation.use-case.js";

export interface RefundAbandonedQuotaReservationsDependencies extends LockedRefundDependencies {
  readonly quotaChargeRepository: LockedRefundDependencies["quotaChargeRepository"] &
    Pick<
      QuotaChargeRepositoryPort,
      "listAbandonedReservations" | "countReservationsBefore" | "clearRequestHashesBefore"
    >;
  readonly alert: OperationalAlertPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "error">;
}

/**
 * 프로세스가 죽어 확정도 환불도 못 한 예약을 돌려준다. 잠금 안에서 최신 상태를 다시 보고 조건부로 저장하므로
 * 여러 번 돌거나 늦게 온 확정·환불·이어받기와 겹쳐도 한 번만 돌려준다.
 */
export class RefundAbandonedQuotaReservationsUseCase {
  readonly #dependencies: RefundAbandonedQuotaReservationsDependencies;

  constructor(dependencies: RefundAbandonedQuotaReservationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(): Promise<void> {
    const { quotaChargeRepository, clock, logger, alert } = this.#dependencies;
    const candidates = await quotaChargeRepository.listAbandonedReservations({
      cutoff: clock.now().subtract({ milliseconds: QUOTA_RESERVATION_TAKEOVER_AFTER_MS }),
      limit: QUOTA_ABANDONED_REFUND_BATCH_SIZE,
    });
    let refundedCount = 0;
    let failedCount = 0;
    for (const candidate of candidates) {
      try {
        const refunded = await refundChargeUnderUserLock(
          this.#dependencies,
          { userId: candidate.userId, chargeId: candidate.id },
          (charge, now) => charge.refundAbandoned(now),
        );
        refundedCount += refunded ? 1 : 0;
      } catch (error) {
        failedCount += 1;
        logger.error({
          event: QuotaLogEvent.REFUND_FAILED,
          chargeId: candidate.id.value,
          meter: candidate.meter,
          errorType: toErrorType(error),
        });
      }
    }
    const staleCount = await quotaChargeRepository.countReservationsBefore(
      clock.now().subtract({ milliseconds: QUOTA_STALE_RESERVATION_ALERT_AFTER_MS }),
    );
    const now = clock.now();
    const clearedHashCount = await quotaChargeRepository.clearRequestHashesBefore({
      cutoff: now.subtract({ milliseconds: QUOTA_REQUEST_HASH_RETENTION_MS }),
      limit: QUOTA_ABANDONED_REFUND_BATCH_SIZE,
      now,
    });
    logger.log({
      event: QuotaLogEvent.ABANDONED_REFUND_COMPLETED,
      candidateCount: candidates.length,
      refundedCount,
      failedCount,
      staleCount,
      clearedHashCount,
    });
    if (failedCount > 0 || staleCount > 0) {
      // 돌려주지 못한 예약은 그 사용자의 한도를 월말까지 깎는다
      alert.raise({
        ...QuotaAlerts.STALE_RESERVATION,
        details: { failedCount, staleCount },
      });
    }
  }
}
