import type { ErrorCodeType } from "@aido/api/errors";

import type { AiProviderErrorKind, AiTaskId } from "../../ports/parsing/ai-provider.port.js";
import type { GenerationMeta } from "../../prompts/structured-output.js";

/** 모든 AI 작업이 같은 필드로 남기는 생성 결과 이벤트. 사용자 원문·제목·카테고리 이름은 남기지 않는다. */
export const AiGenerationLogEvent = {
  COMPLETED: "ai.generation.completed",
  FAILED: "ai.generation.failed",
} as const;

export type AiGenerationOutcome = "SUCCESS" | "NO_ACTION" | "FALLBACK" | "RETRYING" | "FAILED";

interface GenerationLogBase {
  readonly task: AiTaskId;
  readonly promptVersion: string;
  readonly userId: string;
  readonly quotaCharged: boolean;
}

export function generationCompletedLog(
  base: GenerationLogBase & { readonly outcome: AiGenerationOutcome },
  meta: GenerationMeta,
) {
  return {
    event: AiGenerationLogEvent.COMPLETED,
    task: base.task,
    promptVersion: base.promptVersion,
    model: meta.model,
    latencyMs: meta.latencyMs,
    inputTokens: meta.usage.input,
    outputTokens: meta.usage.output,
    reasoningTokens: meta.usage.reasoning,
    finishReason: meta.finishReason,
    outcome: base.outcome,
    quotaCharged: base.quotaCharged,
    userId: base.userId,
  };
}

export function generationFailedLog(
  base: GenerationLogBase & {
    readonly outcome: AiGenerationOutcome;
    readonly errorKind: AiProviderErrorKind;
    readonly statusCode: number | undefined;
    readonly latencyMs: number;
    readonly errorCode?: ErrorCodeType;
  },
) {
  return {
    event: AiGenerationLogEvent.FAILED,
    task: base.task,
    promptVersion: base.promptVersion,
    latencyMs: base.latencyMs,
    outcome: base.outcome,
    errorKind: base.errorKind,
    statusCode: base.statusCode,
    ...(base.errorCode !== undefined && { errorCode: base.errorCode }),
    quotaCharged: base.quotaCharged,
    userId: base.userId,
  };
}
