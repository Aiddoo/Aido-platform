import {
  accessUserNotFound,
  toFeatureQuotaReadModel,
  type AccessStateReaderPort,
} from "#api/modules/access/feature-grants/access-feature-grants-queries.public";
import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { QuotaAllowance } from "../../domain/quota-allowance.vo.js";
import type { QuotaChargeRepositoryPort } from "../ports/quota-charge.repository.port.js";
import type { QuotaUsageRepositoryPort } from "../ports/quota-usage.repository.port.js";
import { quotaReservationInFlight } from "../quota-charges.errors.js";
import { QuotaChargeLogEvent } from "../quota-charges.log-events.js";
import type { QuotaReservationReadModel } from "../read-models/quota-reservation.read-model.js";

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

  execute(reservation: QuotaReservationReadModel): Promise<QuotaReservationReadModel> {
    const {
      unitOfWork,
      userMutationLock,
      accessStateReader,
      quotaChargeRepository,
      quotaUsageRepository,
      clock,
      logger,
    } = this.#dependencies;
    const { userId } = reservation;
    return unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(userId))) {
        throw accessUserNotFound(userId.value);
      }
      const state = await accessStateReader.findAccessState(userId);
      if (state == null) {
        throw accessUserNotFound(userId.value);
      }
      const now = clock.now();
      const allowance = QuotaAllowance.create({ feature: reservation.feature, state, now });
      const rejectInFlight = async (): Promise<never> => {
        const used = await quotaUsageRepository.countUsage({
          userId,
          meter: allowance.meter,
          window: allowance.window,
        });
        throw quotaReservationInFlight(toFeatureQuotaReadModel(allowance.toFeatureQuota(used)));
      };

      const charge = await quotaChargeRepository.findById(reservation.chargeId);
      if (charge == null) {
        return rejectInFlight();
      }
      const expected = charge.version;
      if (!charge.reopen(now) || !(await quotaChargeRepository.saveIfUnchanged(charge, expected))) {
        logger.warn({
          event: QuotaChargeLogEvent.IN_FLIGHT,
          chargeId: charge.id.value,
          meter: charge.meter,
        });
        return rejectInFlight();
      }
      logger.log({
        event: QuotaChargeLogEvent.REOPENED,
        chargeId: charge.id.value,
        meter: charge.meter,
        reason: charge.reason,
      });
      logger.log({
        event: QuotaChargeLogEvent.RESERVED,
        chargeId: charge.id.value,
        meter: charge.meter,
        reason: charge.reason,
      });
      return Object.freeze({
        chargeId: charge.id,
        userId,
        feature: reservation.feature,
        attempt: charge.attempt,
        isAlreadyCommitted: false,
      });
    });
  }
}
