import type { ErrorCodeType } from "@aido/api/errors";
import type { AiProviderId } from "@aido/api/vocabulary";

import {
  AiGenerationError,
  type AiFailureKind,
  type AiUpstreamCause,
} from "./ai-generation.errors.js";
import type { AiGenerationMeta, AiTaskId } from "./ports/ai-generator.port.js";

/** 모든 AI 작업이 같은 필드로 남기는 생성 결과 이벤트. 사용자 원문·제목·카테고리 이름은 남기지 않는다. */
export const AiGenerationLogEvent = {
  COMPLETED: "ai.generation.completed",
  FAILED: "ai.generation.failed",
  COMMIT_MISSED: "ai.generation.commit-missed",
  QUOTA_READ_FAILED: "ai.generation.quota-read-failed",
} as const;

export const AI_GENERATION_OUTCOMES = [
  "SUCCESS",
  "NO_ACTION",
  "FALLBACK",
  "RETRYING",
  "FAILED",
] as const;

export type AiGenerationOutcome = (typeof AI_GENERATION_OUTCOMES)[number];

interface GenerationLogBase {
  readonly task: AiTaskId;
  readonly promptVersion: string;
  readonly userId: string;
  readonly quotaCharged: boolean;
}

export function buildGenerationCompletedLog(
  base: GenerationLogBase & { readonly outcome: AiGenerationOutcome },
  meta: AiGenerationMeta,
) {
  return {
    event: AiGenerationLogEvent.COMPLETED,
    task: base.task,
    promptVersion: base.promptVersion,
    provider: meta.provider,
    model: meta.model,
    attempts: meta.attempts,
    fallbackFrom: meta.fallbackFrom,
    latencyMs: meta.latencyMs,
    inputTokens: meta.inputTokens,
    cachedInputTokens: meta.cachedInputTokens,
    cacheWriteInputTokens: meta.cacheWriteInputTokens,
    outputTokens: meta.outputTokens,
    reasoningTokens: meta.reasoningTokens,
    estimatedCostMicroUsd: meta.estimatedCostMicroUsd,
    finishReason: meta.finishReason,
    outcome: base.outcome,
    quotaCharged: base.quotaCharged,
    userId: base.userId,
  };
}

export interface GenerationFailure {
  readonly errorType: AiFailureKind;
  readonly provider: AiProviderId | null;
  readonly attempts: number;
  readonly fallbackFrom: AiProviderId | null;
  readonly estimatedCostMicroUsd: number | null;
  readonly upstream: AiUpstreamCause | null;
}

/** 실패 로그의 원인 필드. 생성 오류가 아니면 서버 정규화·검증이 거절한 출력으로 본다. */
export function toGenerationFailure(error: unknown): GenerationFailure {
  if (error instanceof AiGenerationError) {
    return {
      errorType: error.kind,
      provider: error.provider,
      attempts: error.attempts,
      fallbackFrom: error.fallbackFrom,
      estimatedCostMicroUsd: error.estimatedCostMicroUsd,
      upstream: error.upstream,
    };
  }
  return {
    errorType: "INVALID_OUTPUT",
    provider: null,
    attempts: 0,
    fallbackFrom: null,
    estimatedCostMicroUsd: null,
    upstream: null,
  };
}

export function buildGenerationFailedLog(
  base: GenerationLogBase &
    GenerationFailure & {
      readonly outcome: AiGenerationOutcome;
      readonly latencyMs: number;
      readonly errorCode?: ErrorCodeType;
    },
) {
  return {
    event: AiGenerationLogEvent.FAILED,
    task: base.task,
    promptVersion: base.promptVersion,
    provider: base.provider,
    attempts: base.attempts,
    fallbackFrom: base.fallbackFrom,
    estimatedCostMicroUsd: base.estimatedCostMicroUsd,
    latencyMs: base.latencyMs,
    outcome: base.outcome,
    errorType: base.errorType,
    ...(base.upstream != null && { upstream: base.upstream }),
    ...(base.errorCode != null && { errorCode: base.errorCode }),
    quotaCharged: base.quotaCharged,
    userId: base.userId,
  };
}
