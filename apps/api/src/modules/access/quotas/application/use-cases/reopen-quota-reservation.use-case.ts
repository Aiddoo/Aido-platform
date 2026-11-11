import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { accessUserNotFound } from "../../../entitlements/application/entitlements.errors.js";
import type { AccessStateReaderPort } from "../../../entitlements/application/ports/access-state.reader.port.js";
import { toFeatureQuotaDetails } from "../../../entitlements/application/read-models/feature-quota.read-model.js";
import { QuotaAllowance } from "../../domain/quota-allowance.vo.js";
import { QuotaChargeId } from "../../domain/quota-charge-id.vo.js";
import type { QuotaChargeRepositoryPort } from "../ports/quota-charge.repository.port.js";
import type { QuotaUsageRepositoryPort } from "../ports/quota-usage.repository.port.js";
import { quotaReservationInFlight } from "../quotas.errors.js";
import { QuotaLogEvent } from "../quotas.log-events.js";
import type { QuotaReservation } from "../read-models/quota-reservation.read-model.js";

export interface ReopenQuotaReservationDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly accessStateReader: Pick<AccessStateReaderPort, "findAccessState">;
  readonly quotaChargeRepository: Pick<QuotaChargeRepositoryPort, "findById" | "saveIfUnchanged">;
  readonly quotaUsageRepository: Pick<QuotaUsageRepositoryPort, "countUsage">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 확정했지만 돌려줄 결과를 잃은 예약을 같은 행에서 다시 연다. 추가로 차감하지 않는다. */
export class ReopenQuotaReservationUseCase {
  readonly #dependencies: ReopenQuotaReservationDependencies;

  constructor(dependencies: ReopenQuotaReservationDependencies) {
    this.#dependencies = dependencies;
  }

  execute(reservation: QuotaReservation): Promise<QuotaReservation> {
    const {
      unitOfWork,
      userMutationLock,
      accessStateReader,
      quotaChargeRepository,
      quotaUsageRepository,
      clock,
      logger,
    } = this.#dependencies;
    const userId = UserId.reconstitute(reservation.userId);
    return unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(UserId.reconstitute(reservation.userId)))) {
        throw accessUserNotFound(reservation.userId);
      }
      const state = await accessStateReader.findAccessState(userId);
      if (state == null) {
        throw accessUserNotFound(reservation.userId);
      }
      const now = clock.now();
      const allowance = QuotaAllowance.create({ feature: reservation.feature, state, now });
      const rejectInFlight = async (): Promise<never> => {
        const used = await quotaUsageRepository.countUsage({
          userId,
          meter: allowance.meter,
          window: allowance.window,
        });
        throw quotaReservationInFlight(toFeatureQuotaDetails(allowance.toFeatureQuota(used)));
      };

      const charge = await quotaChargeRepository.findById(
        QuotaChargeId.reconstitute(reservation.chargeId),
      );
      if (charge == null) {
        return rejectInFlight();
      }
      const expected = charge.version;
      if (!charge.reopen(now) || !(await quotaChargeRepository.saveIfUnchanged(charge, expected))) {
        logger.warn({
          event: QuotaLogEvent.IN_FLIGHT,
          chargeId: charge.id.value,
          meter: charge.meter,
        });
        return rejectInFlight();
      }
      logger.log({
        event: QuotaLogEvent.REOPENED,
        chargeId: charge.id.value,
        meter: charge.meter,
        reason: charge.reason,
      });
      logger.log({
        event: QuotaLogEvent.RESERVED,
        chargeId: charge.id.value,
        meter: charge.meter,
        reason: charge.reason,
      });
      return Object.freeze({
        chargeId: charge.id.value,
        userId: reservation.userId,
        feature: reservation.feature,
        attempt: charge.attempt,
        isAlreadyCommitted: false,
      });
    });
  }
}
