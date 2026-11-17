import type { ErrorCodeType } from "@aido/api/errors";
import type { AiProviderId } from "@aido/api/vocabulary";

import type { AiGenerationMeta } from "../domain/ai-generation.aggregate.js";
import {
  AiGenerationError,
  type AiFailureKind,
  type AiUpstreamCause,
} from "./ai-generations.errors.js";
import type { AiTaskId } from "./ports/ai-generator.port.js";

/**
 * 모든 AI 작업이 같은 필드로 남기는 생성 결과와, 업체를 부르기 전 방어선(입력 상한·킬 스위치·비용 예산)·업체
 * 대체, 배경 AI 작업(리포트·제안 분석)의 예약·실행 이벤트. 사용자 원문·제목·카테고리 이름·프롬프트·응답
 * 본문은 남기지 않는다. 금액은 micro-USD다.
 * 회로 열림·닫힘은 공용 정책의 `outbound.circuit.*`(policy `ai:<업체>`)로 남는다.
 */
export const AiGenerationLogEvent = {
  COMPLETED: "ai-assistance.generation.completed",
  FAILED: "ai-assistance.generation.failed",
  COMMIT_MISSED: "ai-assistance.generation.commit.missed",
  QUOTA_READ_FAILED: "ai-assistance.generation.quota-read.failed",
  INPUT_REJECTED: "ai-assistance.generation.input.rejected",
  SPEND_HALTED: "ai-assistance.spend.halted",
  SPEND_USER_LIMITED: "ai-assistance.spend.user.limited",
  SPEND_THRESHOLD_REACHED: "ai-assistance.spend.threshold.reached",
  SPEND_READ_FAILED: "ai-assistance.spend.read.failed",
  SPEND_RECORD_FAILED: "ai-assistance.spend.record.failed",
  PROVIDER_FALLBACK: "ai-assistance.provider.fallback",
  JOB_STARTED: "ai-assistance.job.started",
  JOB_SKIPPED: "ai-assistance.job.skipped",
  JOB_COMPLETED: "ai-assistance.job.completed",
  JOB_SCHEDULED: "ai-assistance.job.scheduled",
  JOB_DISPATCH_STARTED: "ai-assistance.job.dispatch.started",
  JOB_DISPATCH_COMPLETED: "ai-assistance.job.dispatch.completed",
  JOB_CATCH_UP: "ai-assistance.job.catch-up.dispatched",
} as const;

const AI_GENERATION_OUTCOMES = ["SUCCESS", "NO_ACTION", "FALLBACK", "RETRYING", "FAILED"] as const;

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
