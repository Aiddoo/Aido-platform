import type { MeteredFeatureKey } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type {
  MeteredFeatureQuota,
  QuotaLedgerPort,
  QuotaReservation,
} from "#api/modules/access/quotas/access-quotas.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AiGenerationLogEvent } from "../../../generation/application/ai-generation.log-events.js";
import type { AiTaskId } from "../../../generation/application/ports/ai-generator.port.js";
import { chargeUnconfirmed, emptyGeneration } from "../../application/parsing.errors.js";
import {
  type ChargedGeneration,
  type ChargedGenerationResult,
  ChargedGenerationPort,
  type SettleChargedGenerationInput,
} from "../../application/ports/charged-generation.port.js";

interface QuotaChargedGenerationDependencies {
  readonly quota: Pick<QuotaLedgerPort, "commit" | "refund" | "read">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

function withoutChargedClaim(error: unknown): unknown {
  return error instanceof ApplicationException ? chargeUnconfirmed(error) : error;
}

/** access의 사용량 원장(QuotaLedger)으로 AI 생성의 예약을 확정·환불한다. 그 예약은 정리 잡이 돌려준다. */
export class QuotaChargedGenerationAdapter extends ChargedGenerationPort {
  readonly #dependencies: QuotaChargedGenerationDependencies;

  constructor(dependencies: QuotaChargedGenerationDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  async settle<T>(input: SettleChargedGenerationInput<T>): Promise<ChargedGenerationResult<T>> {
    const { quota } = this.#dependencies;
    const { reservation, generate, beforeCommit } = input;
    let generated: ChargedGeneration<T>;
    try {
      generated = await generate();
    } catch (error) {
      const refunded = await quota.refund(reservation, "FAILED");
      throw refunded ? error : withoutChargedClaim(error);
    }
    const { result, outcome } = generated;
    return match(outcome)
      .with("EMPTY", async () => {
        const refunded = await quota.refund(reservation, "NO_ACTION");
        const empty = emptyGeneration();
        throw refunded ? empty : withoutChargedClaim(empty);
      })
      .with("NO_ACTION", async () => {
        const refunded = await quota.refund(reservation, "NO_ACTION");
        return { result, charged: !refunded, featureQuota: await this.readFeatureQuota(input) };
      })
      .with("CHARGE", async () => {
        await beforeCommit?.(result);
        return {
          result,
          charged: await this.commit(input),
          featureQuota: await this.readFeatureQuota(input),
        };
      })
      .exhaustive();
  }

  async commit(input: {
    readonly reservation: QuotaReservation;
    readonly task: AiTaskId;
  }): Promise<boolean> {
    const committed = await this.#dependencies.quota.commit(input.reservation);
    if (!committed) {
      this.#dependencies.logger.warn({
        event: AiGenerationLogEvent.COMMIT_MISSED,
        task: input.task,
        chargeId: input.reservation.chargeId,
      });
    }
    return committed;
  }

  async readFeatureQuota(input: {
    readonly userId: UserId;
    readonly feature: MeteredFeatureKey;
    readonly task: AiTaskId;
  }): Promise<MeteredFeatureQuota | null> {
    try {
      return await this.#dependencies.quota.read(input.userId, input.feature);
    } catch (error) {
      this.#dependencies.logger.warn({
        event: AiGenerationLogEvent.QUOTA_READ_FAILED,
        feature: input.feature,
        task: input.task,
        errorType: toErrorType(error),
      });
      return null;
    }
  }
}
