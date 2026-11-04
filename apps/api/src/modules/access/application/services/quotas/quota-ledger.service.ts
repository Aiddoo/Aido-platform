import type { EntitlementSnapshot } from "@aido/api";
import { ErrorCode, type ErrorCodeType } from "@aido/api/errors";
import {
  PLAN_CATALOG,
  type MeteredFeatureKey,
  type PlanFeature,
  type QuotaMeter,
} from "@aido/api/vocabulary";
import { mapValues } from "es-toolkit";
import { match } from "ts-pattern";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { QuotaCharge } from "../../../domain/aggregates/quotas/quota-charge.aggregate.js";
import {
  QUOTA_ABANDONED_REFUND_BATCH_SIZE,
  QUOTA_CHARGE_AMOUNT,
  QUOTA_REQUEST_HASH_RETENTION_MS,
  QUOTA_RESERVATION_TAKEOVER_AFTER_MS,
  QUOTA_STALE_RESERVATION_ALERT_AFTER_MS,
} from "../../../domain/constants/quotas/quota.constants.js";
import {
  NO_RESOURCE_BONUSES,
  resolveAccessContext,
  resolveFeatureQuota,
  resolveQuotaLimit,
  type AccessState,
  type AccessTier,
  type FeatureQuotaState,
  type QuotaUsageReading,
} from "../../../domain/policies/entitlement/entitlement.policy.js";
import { QuotaWindow } from "../../../domain/value-objects/quotas/quota-window.vo.js";
import { AccessQuotaLogEvent } from "../../observability/quotas/access-quota-log.events.js";
import type { EntitlementDatabasePort } from "../../ports/entitlement/entitlement-state.port.js";
import type {
  MeteredFeatureQuota,
  QuotaLedgerPort,
  QuotaRefundReason,
  QuotaReservation,
  QuotaReserveInput,
  UnmeteredQuotaFeatureKey,
} from "../../ports/quotas/quota-ledger.port.js";
import type { QuotaLedgerRepositoryPort } from "../../ports/quotas/quota-ledger.repository.port.js";
import type { QuotaUserMutationLockPort } from "../../ports/quotas/quota-user-mutation-lock.port.js";
import { toFeatureQuota } from "../../read-models/entitlement/feature-quota.read-model.js";

interface QuotaLedgerServiceDependencies {
  readonly repository: QuotaLedgerRepositoryPort;
  readonly userMutationLock: QuotaUserMutationLockPort;
  readonly resourceBonuses: Pick<EntitlementDatabasePort, "findResourceBonuses">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly alert: OperationalAlertPort;
  readonly logger: Pick<ApplicationLogger, "log" | "warn" | "error">;
}

/** 기능별 한도 초과 코드. 출시 앱은 AI_PARSE의 AI_1303을 안다. */
const QUOTA_EXHAUSTED_ERROR: Readonly<Record<MeteredFeatureKey, ErrorCodeType>> = {
  AI_PARSE: ErrorCode.AI_1303,
  VOICE_NOTE: ErrorCode.AI_1313,
};

function resolveMeter(feature: MeteredFeatureKey): QuotaMeter {
  return PLAN_CATALOG[feature].meter;
}

/** 원장 판단 한 번에 쓰는 최신 권한과 기간 */
interface QuotaDecisionContext {
  readonly userId: string;
  readonly feature: MeteredFeatureKey;
  readonly tier: AccessTier;
  readonly window: QuotaWindow;
  readonly at: Date;
}

export const QUOTA_STALE_RESERVATION_ALERT_KEY = "access.quota.stale-reservation";

export class QuotaLedgerService implements QuotaLedgerPort {
  readonly #dependencies: QuotaLedgerServiceDependencies;

  constructor(dependencies: QuotaLedgerServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async reserve(input: QuotaReserveInput): Promise<QuotaReservation> {
    const { repository, userMutationLock, unitOfWork } = this.#dependencies;
    return unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(input.userId))) {
        throw new ApplicationException(ErrorCode.USER_0601, { userId: input.userId });
      }
      const context = this.#decisionContext(input, await this.#findAccessState(input.userId));
      const meter = resolveMeter(input.feature);
      const requestHash = input.requestHash ?? null;
      const existing =
        input.idempotencyKey == null
          ? null
          : await repository.findChargeByKey(input.userId, meter, input.idempotencyKey);
      if (existing == null) {
        await this.#addUsage(context);
        const charge = await repository.insertCharge(
          QuotaCharge.planReservation({
            userId: input.userId,
            meter,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            reason: input.reason,
            periodKey: context.window.periodKey,
            at: context.at,
          }),
        );
        return this.#reserved(context, charge, false);
      }
      if (!existing.isSameRequest({ reason: input.reason, requestHash })) {
        this.#dependencies.logger.warn({
          event: AccessQuotaLogEvent.KEY_REUSED,
          chargeId: existing.id,
          meter,
        });
        throw new ApplicationException(ErrorCode.AI_1318, { charged: false });
      }
      return this.#replay(context, existing, input.reason);
    });
  }

  async reopen(reservation: QuotaReservation): Promise<QuotaReservation> {
    const { repository, userMutationLock, unitOfWork } = this.#dependencies;
    const { userId, feature, chargeId } = reservation;
    return unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(userId))) {
        throw new ApplicationException(ErrorCode.USER_0601, { userId });
      }
      const context = this.#decisionContext(
        { userId, feature },
        await this.#findAccessState(userId),
      );
      const charge = await repository.findCharge(chargeId);
      if (charge == null) {
        throw new ApplicationException(ErrorCode.AI_1314, {
          charged: false,
          featureQuota: toFeatureQuota(await this.#featureQuota(context)),
        });
      }
      const expected = { status: charge.status, attempt: charge.attempt };
      if (!charge.reopen(context.at) || !(await repository.updateCharge(charge, expected))) {
        return this.#rejectInFlight(context, charge);
      }
      this.#dependencies.logger.log({
        event: AccessQuotaLogEvent.REOPENED,
        chargeId,
        meter: charge.meter,
        reason: charge.reason,
      });
      return this.#reserved(context, charge, false);
    });
  }

  async commit(reservation: QuotaReservation): Promise<boolean> {
    if (reservation.alreadyCommitted) {
      return false;
    }
    const meter = resolveMeter(reservation.feature);
    try {
      const { repository } = this.#dependencies;
      const charge = await repository.findCharge(reservation.chargeId);
      if (charge == null) {
        return false;
      }
      const expected = { status: charge.status, attempt: charge.attempt };
      if (!charge.commit(reservation.attempt, now())) {
        return false;
      }
      if (!(await repository.updateCharge(charge, expected))) {
        return false;
      }
      this.#dependencies.logger.log({
        event: AccessQuotaLogEvent.COMMITTED,
        chargeId: charge.id,
        meter,
        reason: charge.reason,
      });
      return true;
    } catch (error) {
      this.#dependencies.logger.error({
        event: AccessQuotaLogEvent.COMMIT_FAILED,
        chargeId: reservation.chargeId,
        meter,
        errorType: toErrorType(error),
      });
      return false;
    }
  }

  async refund(reservation: QuotaReservation, reason: QuotaRefundReason): Promise<boolean> {
    if (reservation.alreadyCommitted) {
      return false;
    }
    const meter = resolveMeter(reservation.feature);
    try {
      const refunded = await this.#refundLocked(
        { userId: reservation.userId, chargeId: reservation.chargeId },
        (charge) => charge.refund({ attempt: reservation.attempt, reason, at: now() }),
      );
      if (refunded) {
        this.#dependencies.logger.log({
          event: AccessQuotaLogEvent.REFUNDED,
          chargeId: reservation.chargeId,
          meter,
          reason,
        });
      }
      return refunded;
    } catch (error) {
      this.#dependencies.logger.error({
        event: AccessQuotaLogEvent.REFUND_FAILED,
        chargeId: reservation.chargeId,
        meter,
        errorType: toErrorType(error),
      });
      return false;
    }
  }

  /**
   * 프로세스가 죽어 확정도 환불도 못 한 예약을 돌려준다. 잠금 안에서 최신 상태를 다시 보고 조건부로 저장하므로
   * 여러 번 돌거나 늦게 온 확정·환불·이어받기와 겹쳐도 한 번만 돌려준다.
   */
  async refundAbandonedReservations(): Promise<void> {
    const { repository, logger } = this.#dependencies;
    const cutoff = new Date(now().getTime() - QUOTA_RESERVATION_TAKEOVER_AFTER_MS);
    const candidates = await repository.findAbandonedReservations(
      cutoff,
      QUOTA_ABANDONED_REFUND_BATCH_SIZE,
    );
    let refundedCount = 0;
    let failedCount = 0;
    for (const candidate of candidates) {
      try {
        const refunded = await this.#refundLocked(
          { userId: candidate.userId, chargeId: candidate.id },
          (charge) => charge.refundAbandoned(now()),
        );
        refundedCount += refunded ? 1 : 0;
      } catch (error) {
        failedCount += 1;
        logger.error({
          event: AccessQuotaLogEvent.REFUND_FAILED,
          chargeId: candidate.id,
          meter: candidate.meter,
          errorType: toErrorType(error),
        });
      }
    }
    const staleCount = await repository.countReservationsBefore(
      new Date(now().getTime() - QUOTA_STALE_RESERVATION_ALERT_AFTER_MS),
    );
    const clearedHashCount = await repository.clearRequestHashesBefore(
      new Date(now().getTime() - QUOTA_REQUEST_HASH_RETENTION_MS),
      QUOTA_ABANDONED_REFUND_BATCH_SIZE,
    );
    logger.log({
      event: AccessQuotaLogEvent.ABANDONED_REFUND_COMPLETED,
      candidateCount: candidates.length,
      refundedCount,
      failedCount,
      staleCount,
      clearedHashCount,
    });
    if (failedCount > 0 || staleCount > 0) {
      // 돌려주지 못한 예약은 그 사용자의 한도를 월말까지 깎는다.
      this.#dependencies.alert.raise({
        key: QUOTA_STALE_RESERVATION_ALERT_KEY,
        severity: "error",
        message: "횟수 예약을 돌려주지 못하고 있습니다.",
        details: { failedCount, staleCount },
      });
    }
  }

  async read(userId: string, feature: MeteredFeatureKey): Promise<MeteredFeatureQuota> {
    const context = this.#decisionContext({ userId, feature }, await this.#findAccessState(userId));
    const usage = await this.#readUsage(userId, feature, context.window);
    const state = resolveFeatureQuota({
      tier: context.tier,
      feature,
      resourceBonuses: NO_RESOURCE_BONUSES,
      usage,
    });
    return { ...toFeatureQuota(state), used: usage.used, resetsAt: toISOString(usage.resetsAt) };
  }

  async readSnapshot(
    userId: string,
    dailyUsage: Readonly<Record<UnmeteredQuotaFeatureKey, QuotaUsageReading>>,
  ): Promise<EntitlementSnapshot> {
    const [state, resourceBonuses] = await Promise.all([
      this.#findAccessState(userId),
      this.#dependencies.resourceBonuses.findResourceBonuses(userId),
    ]);
    const at = now();
    const { tier, isPremium } = resolveAccessContext(state, at);
    const window = QuotaWindow.monthAt(at);
    const [aiParse, voiceNote] = await Promise.all([
      this.#readUsage(userId, "AI_PARSE", window),
      this.#readUsage(userId, "VOICE_NOTE", window),
    ]);
    const usage: Readonly<Partial<Record<PlanFeature, QuotaUsageReading>>> = {
      ...dailyUsage,
      AI_PARSE: aiParse,
      VOICE_NOTE: voiceNote,
    };
    return {
      isPremium,
      tier,
      features: mapValues(PLAN_CATALOG, (_definition, feature) =>
        toFeatureQuota(
          resolveFeatureQuota({ tier, feature, resourceBonuses, usage: usage[feature] ?? null }),
        ),
      ),
    };
  }

  /** 사용자 행을 잠그고 최신 차감에 환불 전이를 적용한다. 전이가 실제로 저장되면 사용량을 되돌린다. */
  async #refundLocked(
    target: { readonly userId: string; readonly chargeId: string },
    transition: (charge: QuotaCharge) => boolean,
  ): Promise<boolean> {
    const { repository, userMutationLock, unitOfWork } = this.#dependencies;
    return unitOfWork.run(async () => {
      if (!(await userMutationLock.lockById(target.userId))) {
        return false;
      }
      const charge = await repository.findCharge(target.chargeId);
      if (charge == null) {
        return false;
      }
      const expected = { status: charge.status, attempt: charge.attempt };
      if (!transition(charge) || !(await repository.updateCharge(charge, expected))) {
        return false;
      }
      await repository.subtractUsage(target.userId, charge.meter, {
        periodKey: charge.periodKey,
        amount: charge.amount,
      });
      return true;
    });
  }

  async #replay(
    context: QuotaDecisionContext,
    charge: QuotaCharge,
    reason: string,
  ): Promise<QuotaReservation> {
    const { repository } = this.#dependencies;
    const expected = { status: charge.status, attempt: charge.attempt };
    return match(charge.replayAt(context.at))
      .with("COMMITTED", () => this.#reserved(context, charge, true))
      .with("IN_FLIGHT", () => this.#rejectInFlight(context, charge))
      .with("TAKE_OVER", async () => {
        // 달을 넘겨 이어받으면 지난달 예약은 쓰이지 않았으므로 새 달 한도로 다시 잡고 지난달 몫을 돌려놓는다.
        const previousPeriodKey = charge.periodKey;
        const crossesPeriod = previousPeriodKey !== context.window.periodKey;
        if (crossesPeriod) {
          await this.#addUsage(context);
        }
        charge.takeOver({ periodKey: context.window.periodKey, at: context.at });
        if (!(await repository.updateCharge(charge, expected))) {
          return this.#rejectInFlight(context, charge);
        }
        if (crossesPeriod) {
          await repository.subtractUsage(context.userId, charge.meter, {
            periodKey: previousPeriodKey,
            amount: charge.amount,
          });
        }
        return this.#reserved(context, charge, false);
      })
      .with("RETRY", async () => {
        await this.#addUsage(context);
        charge.reserveAgain({ reason, periodKey: context.window.periodKey, at: context.at });
        if (!(await repository.updateCharge(charge, expected))) {
          return this.#rejectInFlight(context, charge);
        }
        return this.#reserved(context, charge, false);
      })
      .exhaustive();
  }

  async #rejectInFlight(context: QuotaDecisionContext, charge: QuotaCharge): Promise<never> {
    this.#dependencies.logger.warn({
      event: AccessQuotaLogEvent.IN_FLIGHT,
      chargeId: charge.id,
      meter: charge.meter,
    });
    throw new ApplicationException(ErrorCode.AI_1314, {
      charged: false,
      featureQuota: toFeatureQuota(await this.#featureQuota(context)),
    });
  }

  async #addUsage(context: QuotaDecisionContext): Promise<void> {
    const { repository, logger } = this.#dependencies;
    const meter = resolveMeter(context.feature);
    const { limit } = resolveQuotaLimit(context.tier, context.feature);
    const added = await repository.addUsage(context.userId, meter, {
      window: context.window,
      at: context.at,
      amount: QUOTA_CHARGE_AMOUNT,
      limit,
    });
    if (added) {
      return;
    }
    logger.warn({ event: AccessQuotaLogEvent.EXHAUSTED, meter, tier: context.tier });
    throw new ApplicationException(QUOTA_EXHAUSTED_ERROR[context.feature], {
      charged: false,
      featureQuota: toFeatureQuota(await this.#featureQuota(context)),
    });
  }

  #reserved(
    context: QuotaDecisionContext,
    charge: QuotaCharge,
    alreadyCommitted: boolean,
  ): QuotaReservation {
    if (!alreadyCommitted) {
      this.#dependencies.logger.log({
        event: AccessQuotaLogEvent.RESERVED,
        chargeId: charge.id,
        meter: charge.meter,
        reason: charge.reason,
      });
    }
    return Object.freeze({
      chargeId: charge.id,
      userId: context.userId,
      feature: context.feature,
      attempt: charge.attempt,
      alreadyCommitted,
    });
  }

  async #featureQuota(context: QuotaDecisionContext): Promise<FeatureQuotaState> {
    return resolveFeatureQuota({
      tier: context.tier,
      feature: context.feature,
      resourceBonuses: NO_RESOURCE_BONUSES,
      usage: await this.#readUsage(context.userId, context.feature, context.window),
    });
  }

  async #readUsage(
    userId: string,
    feature: MeteredFeatureKey,
    window: QuotaWindow,
  ): Promise<QuotaUsageReading> {
    const used = await this.#dependencies.repository.readUsed(
      userId,
      resolveMeter(feature),
      window,
    );
    return { used, resetsAt: window.resetsAt };
  }

  #decisionContext(
    input: { readonly userId: string; readonly feature: MeteredFeatureKey },
    state: AccessState,
  ): QuotaDecisionContext {
    const at = now();
    return {
      userId: input.userId,
      feature: input.feature,
      tier: resolveAccessContext(state, at).tier,
      window: QuotaWindow.monthAt(at),
      at,
    };
  }

  async #findAccessState(userId: string): Promise<AccessState> {
    const state = await this.#dependencies.repository.findAccessState(userId);
    if (state == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    return state;
  }
}
