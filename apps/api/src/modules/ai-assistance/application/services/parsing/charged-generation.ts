import { ErrorCode } from "@aido/api/errors";
import type { MeteredFeatureKey } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type {
  MeteredFeatureQuota,
  QuotaLedgerPort,
  QuotaReservation,
} from "#api/modules/access/access-quota.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { AiGenerationLogEvent } from "../../observability/generation/ai-generation-log.events.js";
import type { AiTaskId } from "../../ports/generation/ai-generator.port.js";
import { readFeatureQuotaOrNull, withoutChargedClaim } from "./ai-parsing-error-code.js";

/** 결과를 준 뒤의 차감: 확정(CHARGE), 줄 결과는 있지만 환불(NO_ACTION), 줄 결과가 없어 AI_1302(EMPTY). */
export type ChargeOutcome = "CHARGE" | "NO_ACTION" | "EMPTY";

export interface ChargedGeneration<T> {
  readonly result: T;
  readonly outcome: ChargeOutcome;
}

export interface ChargedGenerationResult<T> {
  readonly result: T;
  /** 끝난 뒤에도 횟수가 차감된 상태인지. 환불·확정을 마치지 못했으면 실제 상태에 맞춰 답한다. */
  readonly charged: boolean;
  /** 결과를 준 뒤 한도를 읽지 못했으면 null이다. 차감한 결과를 잃지 않으려고 오류로 바꾸지 않는다. */
  readonly featureQuota: MeteredFeatureQuota | null;
}

interface ChargedGenerationDependencies {
  readonly quota: Pick<QuotaLedgerPort, "commit" | "refund" | "read">;
  readonly logger: Pick<ApplicationLogger, "warn">;
}

/**
 * 돈이 드는 AI 작업의 예약 뒤 흐름 하나: 생성 → 실패·빈 결과면 환불, 결과가 있으면 확정.
 * 환불을 마친 실패만 charged:false를 주장하고, 확정하지 못하면 charged:false로 답한다.
 * 그 예약은 정리 잡이 돌려주므로 결과를 준 뒤에도 차감으로 남지 않는다.
 */
export async function settleChargedGeneration<T>(
  dependencies: ChargedGenerationDependencies,
  input: {
    readonly reservation: QuotaReservation;
    readonly userId: string;
    readonly feature: MeteredFeatureKey;
    readonly task: AiTaskId;
    readonly generate: () => Promise<ChargedGeneration<T>>;
    /** 확정 직전에 부른다. 사이에 온 재요청은 처리 중(AI_1314)으로 답한다. */
    readonly beforeCommit?: (result: T) => Promise<void>;
  },
): Promise<ChargedGenerationResult<T>> {
  const { quota } = dependencies;
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
      const empty = new ApplicationException(ErrorCode.AI_1302, { charged: false });
      throw refunded ? empty : withoutChargedClaim(empty);
    })
    .with("NO_ACTION", async () => {
      const refunded = await quota.refund(reservation, "NO_ACTION");
      return {
        result,
        charged: !refunded,
        featureQuota: await readFeatureQuotaOrNull(dependencies, input),
      };
    })
    .with("CHARGE", async () => {
      await beforeCommit?.(result);
      return {
        result,
        charged: await commitOrWarn(dependencies, input),
        featureQuota: await readFeatureQuotaOrNull(dependencies, input),
      };
    })
    .exhaustive();
}

/** 이미 있는 결과를 돌려주며 그 결과의 예약을 확정한다. */
export async function commitOrWarn(
  dependencies: ChargedGenerationDependencies,
  input: { readonly reservation: QuotaReservation; readonly task: AiTaskId },
): Promise<boolean> {
  const committed = await dependencies.quota.commit(input.reservation);
  if (!committed) {
    dependencies.logger.warn({
      event: AiGenerationLogEvent.COMMIT_MISSED,
      task: input.task,
      chargeId: input.reservation.chargeId,
    });
  }
  return committed;
}
