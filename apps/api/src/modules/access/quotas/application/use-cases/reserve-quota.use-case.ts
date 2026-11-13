import { match } from "ts-pattern";

import {
  accessUserNotFound,
  toFeatureQuotaDetails,
  type AccessStateReaderPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { QuotaAllowance } from "../../domain/quota-allowance.vo.js";
import { QuotaChargeId } from "../../domain/quota-charge-id.vo.js";
import { QuotaCharge } from "../../domain/quota-charge.aggregate.js";
import { QUOTA_CHARGE_AMOUNT } from "../../domain/quotas.constants.js";
import type { QuotaChargeRepositoryPort } from "../ports/quota-charge.repository.port.js";
import type { QuotaReserveInput } from "../ports/quota-ledger.port.js";
import type { QuotaUsageRepositoryPort } from "../ports/quota-usage.repository.port.js";
import { quotaExhausted, quotaKeyReused, quotaReservationInFlight } from "../quotas.errors.js";
import { QuotaLogEvent } from "../quotas.log-events.js";
import type { QuotaReservation } from "../read-models/quota-reservation.read-model.js";

export type ReserveQuotaCommand = QuotaReserveInput;

export interface ReserveQuotaDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly accessStateReader: Pick<AccessStateReaderPort, "findAccessState">;
  readonly quotaChargeRepository: Pick<
    QuotaChargeRepositoryPort,
    "findByIdempotencyKey" | "save" | "saveIfUnchanged"
  >;
  readonly quotaUsageRepository: QuotaUsageRepositoryPort;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 원장 판단 한 번에 쓰는 사용자·최신 권한·시각 */
interface ReserveDecision {
  readonly userId: UserId;
  readonly allowance: QuotaAllowance;
  readonly now: Temporal.Instant;
}

/** AI 호출 전에 사용자 잠금 안에서 횟수를 원자적으로 차감한다. 같은 키 재요청은 행 하나로 이어 간다. */
export class ReserveQuotaUseCase {
  readonly #dependencies: ReserveQuotaDependencies;

  constructor(dependencies: ReserveQuotaDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: ReserveQuotaCommand): Promise<QuotaReservation> {
    const { unitOfWork, userMutationLock, accessStateReader, quotaChargeRepository, clock } =
      this.#dependencies;
    const { userId } = command;
    return unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(userId))) {
        throw accessUserNotFound(userId.value);
      }
      const state = await accessStateReader.findAccessState(userId);
      if (state == null) {
        throw accessUserNotFound(userId.value);
      }
      const now = clock.now();
      const decision: ReserveDecision = {
        userId,
        allowance: QuotaAllowance.create({ feature: command.feature, state, now }),
        now,
      };
      const requestHash = command.requestHash ?? null;
      const existing =
        command.idempotencyKey == null
          ? null
          : await quotaChargeRepository.findByIdempotencyKey({
              userId,
              meter: decision.allowance.meter,
              idempotencyKey: command.idempotencyKey,
            });
      if (existing == null) {
        await this.#addUsage(decision);
        const charge = QuotaCharge.create({
          id: QuotaChargeId.generate(),
          userId,
          meter: decision.allowance.meter,
          idempotencyKey: command.idempotencyKey,
          requestHash,
          reason: command.reason,
          window: decision.allowance.window,
          now,
        });
        await quotaChargeRepository.save(charge);
        return this.#reserved(decision, charge, false);
      }
      if (!existing.isSameRequest({ reason: command.reason, requestHash })) {
        this.#dependencies.logger.warn({
          event: QuotaLogEvent.KEY_REUSED,
          chargeId: existing.id.value,
          meter: existing.meter,
        });
        throw quotaKeyReused();
      }
      return this.#replay(decision, existing, command.reason);
    });
  }

  async #replay(
    decision: ReserveDecision,
    charge: QuotaCharge,
    reason: string,
  ): Promise<QuotaReservation> {
    const { quotaChargeRepository, quotaUsageRepository } = this.#dependencies;
    const { allowance, now } = decision;
    const expected = charge.version;
    return match(charge.resolveReplayAt(now))
      .with("COMMITTED", () => this.#reserved(decision, charge, true))
      .with("IN_FLIGHT", () => this.#rejectInFlight(decision, charge))
      .with("TAKE_OVER", async () => {
        // 달을 넘겨 이어받으면 지난달 예약은 쓰이지 않았으므로 새 달 한도로 다시 잡고 지난달 몫을 돌려놓는다
        const previousPeriodKey = charge.periodKey;
        const crossesPeriod = previousPeriodKey !== allowance.window.periodKey;
        if (crossesPeriod) {
          await this.#addUsage(decision);
        }
        charge.takeOver({ window: allowance.window, now });
        if (!(await quotaChargeRepository.saveIfUnchanged(charge, expected))) {
          return this.#rejectInFlight(decision, charge);
        }
        if (crossesPeriod) {
          await quotaUsageRepository.subtractUsage({
            userId: decision.userId,
            meter: charge.meter,
            periodKey: previousPeriodKey,
            amount: charge.amount,
            now,
          });
        }
        return this.#reserved(decision, charge, false);
      })
      .with("RETRY", async () => {
        await this.#addUsage(decision);
        charge.reserveAgain({ reason, window: allowance.window, now });
        if (!(await quotaChargeRepository.saveIfUnchanged(charge, expected))) {
          return this.#rejectInFlight(decision, charge);
        }
        return this.#reserved(decision, charge, false);
      })
      .exhaustive();
  }

  async #addUsage(decision: ReserveDecision): Promise<void> {
    const { quotaUsageRepository, logger } = this.#dependencies;
    const { userId, allowance, now } = decision;
    const added = await quotaUsageRepository.addUsageWithinLimit({
      userId,
      meter: allowance.meter,
      window: allowance.window,
      amount: QUOTA_CHARGE_AMOUNT,
      limit: allowance.limit,
      now,
    });
    if (added) {
      return;
    }
    logger.warn({ event: QuotaLogEvent.EXHAUSTED, meter: allowance.meter, plan: allowance.plan });
    throw quotaExhausted(
      allowance.feature,
      toFeatureQuotaDetails(await this.#featureQuota(decision)),
    );
  }

  async #rejectInFlight(decision: ReserveDecision, charge: QuotaCharge): Promise<never> {
    this.#dependencies.logger.warn({
      event: QuotaLogEvent.IN_FLIGHT,
      chargeId: charge.id.value,
      meter: charge.meter,
    });
    throw quotaReservationInFlight(toFeatureQuotaDetails(await this.#featureQuota(decision)));
  }

  async #featureQuota(decision: ReserveDecision) {
    const { allowance, userId } = decision;
    const used = await this.#dependencies.quotaUsageRepository.countUsage({
      userId,
      meter: allowance.meter,
      window: allowance.window,
    });
    return allowance.toFeatureQuota(used);
  }

  #reserved(
    decision: ReserveDecision,
    charge: QuotaCharge,
    isAlreadyCommitted: boolean,
  ): QuotaReservation {
    if (!isAlreadyCommitted) {
      this.#dependencies.logger.log({
        event: QuotaLogEvent.RESERVED,
        chargeId: charge.id.value,
        meter: charge.meter,
        reason: charge.reason,
      });
    }
    return Object.freeze({
      chargeId: charge.id.value,
      userId: decision.userId.value,
      feature: decision.allowance.feature,
      attempt: charge.attempt,
      isAlreadyCommitted,
    });
  }
}
