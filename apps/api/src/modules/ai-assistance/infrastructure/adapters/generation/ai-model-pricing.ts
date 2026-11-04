import type { LanguageModelUsage } from "ai";

interface ModelPrice {
  /** 입력 1M 토큰당 USD */
  readonly input: number;
  /** 출력(사고 토큰 포함) 1M 토큰당 USD */
  readonly output: number;
}

/** 공식 가격표(2026-11-04). 모델을 env로 바꾸면 여기에도 더해야 비용이 추정된다. */
export const AI_MODEL_PRICING: Readonly<Record<string, ModelPrice>> = {
  "anthropic:claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "google:gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "openai:gpt-6-luna": { input: 0.1, output: 0.5 },
};

/** 1M 토큰당 USD는 토큰당 micro-USD와 같다. 가격을 모르는 모델은 null이다. */
export function estimateCostMicroUsd(
  model: string,
  usage: Pick<LanguageModelUsage, "inputTokens" | "outputTokens"> | undefined,
): number | null {
  const price = AI_MODEL_PRICING[model];
  if (price == null) {
    return null;
  }
  if (usage == null) {
    return 0;
  }
  return Math.round(
    (usage.inputTokens ?? 0) * price.input + (usage.outputTokens ?? 0) * price.output,
  );
}
