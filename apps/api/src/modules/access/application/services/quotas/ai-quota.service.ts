import type { AiUsageData } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { AiQuotaUsage } from "../../../domain/aggregates/quotas/ai-quota-usage.aggregate.js";
import {
  Feature,
  resolveFeatureLimit,
} from "../../../domain/policies/entitlement/entitlement-limits.policy.js";
import { getNextAiQuotaResetAt } from "../../../domain/policies/quotas/ai-quota-period.policy.js";
import { AccessQuotaLogEvent } from "../../observability/quotas/access-quota-log.events.js";
import type { AiQuotaUserMutationLockPort } from "../../ports/quotas/ai-quota-user-mutation-lock.port.js";
import type { AiQuotaPort, AiQuotaReservation } from "../../ports/quotas/ai-quota.port.js";
import type {
  AiQuotaRepositoryPort,
  AiQuotaState,
} from "../../ports/quotas/ai-quota.repository.port.js";

interface AiQuotaServiceDependencies {
  readonly repository: AiQuotaRepositoryPort;
  readonly userMutationLock: AiQuotaUserMutationLockPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class AiQuotaService implements AiQuotaPort {
  readonly #dependencies: AiQuotaServiceDependencies;

  constructor(dependencies: AiQuotaServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async read(userId: string): Promise<AiUsageData> {
    const state = await this.#findQuotaState(userId);
    const at = now();
    const usage = AiQuotaUsage.reconstitute({ userId, count: state.count, resetAt: state.resetAt });
    return {
      used: usage.usedAt(at),
      limit: resolveFeatureLimit(state.role, state.subscriptionStatus, Feature.AI_PARSE),
      resetsAt: toISOString(getNextAiQuotaResetAt(at)),
    };
  }

  async reserve(userId: string): Promise<AiQuotaReservation> {
    return this.#dependencies.unitOfWork.run(async () => {
      if (!(await this.#dependencies.userMutationLock.lockById(userId))) {
        throw new ApplicationException(ErrorCode.USER_0601, { userId });
      }
      const state = await this.#findQuotaState(userId);
      const usage = AiQuotaUsage.reconstitute({
        userId,
        count: state.count,
        resetAt: state.resetAt,
      });
      const decision = usage.reserve({
        at: now(),
        limit: resolveFeatureLimit(state.role, state.subscriptionStatus, Feature.AI_PARSE),
      });
      if (decision.status === "exceeded") {
        throw new ApplicationException(ErrorCode.AI_1303, {
          used: decision.used,
          limit: decision.limit,
        });
      }
      await this.#dependencies.repository.saveUsage(userId, decision.usage);
      return Object.freeze({ userId, periodId: decision.periodId });
    });
  }

  async release(reservation: AiQuotaReservation): Promise<void> {
    try {
      const released = await this.#dependencies.unitOfWork.run(async () => {
        const { userMutationLock, repository } = this.#dependencies;
        if (!(await userMutationLock.lockById(reservation.userId))) return false;
        const state = await repository.findQuotaState(reservation.userId);
        if (state === null) return false;
        const usage = AiQuotaUsage.reconstitute({
          userId: reservation.userId,
          count: state.count,
          resetAt: state.resetAt,
        });
        const release = usage.release(reservation.periodId);
        if (release === null) return false;
        return repository.releaseUsage(reservation.userId, release);
      });
      if (released) {
        this.#dependencies.logger.debug({
          event: AccessQuotaLogEvent.RESERVATION_RELEASED,
          userId: reservation.userId,
        });
      }
    } catch (error) {
      this.#dependencies.logger.error({
        event: AccessQuotaLogEvent.RESERVATION_RELEASE_FAILED,
        userId: reservation.userId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  async #findQuotaState(userId: string): Promise<AiQuotaState> {
    const state = await this.#dependencies.repository.findQuotaState(userId);
    if (state === null) throw new ApplicationException(ErrorCode.USER_0601, { userId });
    return state;
  }
}
