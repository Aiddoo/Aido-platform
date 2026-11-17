import type { LanguageModelUsage } from "ai";

import type { AiFailureKind } from "../../application/ai-generations.errors.js";
import type { AiGenerationUsage } from "../../domain/ai-generation.aggregate.js";

interface FinishedText {
  readonly finishReason: string;
  readonly text: string;
}

/**
 * 출력을 쓸 수 없게 끝난 응답의 실패 종류. 안전 정책으로 막히면 SDK는 throw 없이 끝나고, 추론이 출력 상한을
 * 다 쓰면 본문 없이 끝나 둘 다 output 접근에서야 스키마 오류처럼 실패한다.
 */
export function findUnusableFinish(generated: FinishedText): AiFailureKind | null {
  if (generated.finishReason === "content-filter") {
    return "BLOCKED";
  }
  if (generated.finishReason === "length" && generated.text.trim() === "") {
    return "TRUNCATED";
  }
  return null;
}

export function toGenerationUsage(usage: LanguageModelUsage): AiGenerationUsage {
  return {
    inputTokens: usage.inputTokens ?? 0,
    cachedInputTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
    cacheWriteInputTokens: usage.inputTokenDetails.cacheWriteTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? 0,
  };
}
