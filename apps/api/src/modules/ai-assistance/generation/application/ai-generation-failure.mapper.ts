import type { ErrorCodeType } from "@aido/api/errors";
import type { MeteredFeatureKey } from "@aido/api/vocabulary";

import type { MeteredFeatureQuota, QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { resolveAiFailureRule } from "./ai-generation.errors.js";
import {
  AiGenerationLogEvent,
  type GenerationFailure,
  toGenerationFailure,
} from "./ai-generation.log-events.js";
import type { AiTaskId } from "./ports/ai-generator.port.js";

export interface ParsingFailure extends GenerationFailure {
  readonly errorCode: ErrorCodeType;
}

/** 생성 실패 종류를 사용자 응답 코드로 바꾼다. 일시 장애를 "이해 못함"으로 보내지 않는다. */
export function describeParsingFailure(error: unknown): ParsingFailure {
  const failure = toGenerationFailure(error);
  return { ...failure, errorCode: resolveAiFailureRule(failure.errorType).errorCode };
}

/** 환불하지 못한 요청은 차감 여부를 보장할 수 없으므로 details의 charged:false를 떼고 같은 코드로 던진다. */
export function withoutChargedClaim(error: unknown): unknown {
  return error instanceof ApplicationException ? new ApplicationException(error.errorCode) : error;
}

/** 확정·환불 뒤의 한도 읽기. 실패해도 이미 만든 결과를 잃지 않게 null을 돌려준다(응답 칸은 optional이다). */
export async function readFeatureQuotaOrNull(
  dependencies: {
    readonly quota: Pick<QuotaLedgerPort, "read">;
    readonly logger: Pick<ApplicationLoggerPort, "warn">;
  },
  input: {
    readonly userId: string;
    readonly feature: MeteredFeatureKey;
    readonly task: AiTaskId;
  },
): Promise<MeteredFeatureQuota | null> {
  try {
    return await dependencies.quota.read(input.userId, input.feature);
  } catch (error) {
    dependencies.logger.warn({
      event: AiGenerationLogEvent.QUOTA_READ_FAILED,
      feature: input.feature,
      task: input.task,
      errorType: toErrorType(error),
    });
    return null;
  }
}
