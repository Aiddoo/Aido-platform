import type { LanguageModelUsage } from "ai";

interface ModelPrice {
  /** 입력 1M 토큰당 USD */
  readonly input: number;
  /** 프롬프트 캐시에서 읽은 입력 1M 토큰당 USD */
  readonly cacheRead: number;
  /** 프롬프트 캐시에 새로 쓴 입력 1M 토큰당 USD(Claude 5분 캐시. Gemini 자동 캐시는 별도 값이 없어 입력 단가) */
  readonly cacheWrite: number;
  /** 출력(사고 토큰 포함) 1M 토큰당 USD */
  readonly output: number;
}

/** 공식 가격표(2026-11-05). 모델을 env로 바꾸면 여기에도 더해야 비용이 추정된다. */
const AI_MODEL_PRICING: Readonly<Record<string, ModelPrice>> = {
  "anthropic:claude-haiku-5-5": { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 },
  "google:gemini-3.1-flash-lite": { input: 0.25, cacheRead: 0.025, cacheWrite: 0.25, output: 1.5 },
  "openai:gpt-6-luna": { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 },
};

/** model은 AI_MODEL_PRICING의 키 형식(`업체:모델`)이다. */
export function hasKnownPricing(model: string): boolean {
  return AI_MODEL_PRICING[model] != null;
}

type TokenUsage = Pick<LanguageModelUsage, "inputTokens" | "inputTokenDetails" | "outputTokens">;

/** 입력 전체 토큰은 캐시 읽기·쓰기를 포함하므로 나머지만 입력 단가로 센다. */
function calculateUsageCost(usage: TokenUsage, inputTokens: number, price: ModelPrice): number {
  const read = usage.inputTokenDetails.cacheReadTokens ?? 0;
  const write = usage.inputTokenDetails.cacheWriteTokens ?? 0;
  return Math.round(
    Math.max(inputTokens - read - write, 0) * price.input +
      read * price.cacheRead +
      write * price.cacheWrite +
      (usage.outputTokens ?? 0) * price.output,
  );
}

/** 1M 토큰당 USD는 토큰당 micro-USD와 같다. 가격을 모르는 모델은 null이다. */
export function estimateCostMicroUsd(model: string, usage: TokenUsage | undefined): number | null {
  const price = AI_MODEL_PRICING[model];
  if (price == null) {
    return null;
  }
  if (usage == null) {
    return 0;
  }
  return calculateUsageCost(usage, usage.inputTokens ?? 0, price);
}

const HIGHEST_INPUT_PRICE = Math.max(
  ...Object.values(AI_MODEL_PRICING).map((price) => price.input),
);
const HIGHEST_OUTPUT_PRICE = Math.max(
  ...Object.values(AI_MODEL_PRICING).map((price) => price.output),
);

/**
 * 예산에 더하는 보수적 추정 비용. 단가를 모르는 모델은 최고 단가로 출력 상한까지 쓴 것으로 보고,
 * 사용량 없이 시간 초과로 끝난 호출은 업체가 입력을 이미 처리했다고 보고 입력 비용을 더한다.
 * 입력 토큰을 모르면 글자 수를 토큰 수로 본다(한국어는 글자당 1토큰 안팎이라 넉넉한 쪽이다).
 */
export function estimateSpendMicroUsd(input: {
  readonly model: string;
  readonly usage: TokenUsage | undefined;
  readonly inputChars: number;
  readonly maxOutputTokens: number;
  readonly timedOut: boolean;
}): number {
  const { model, usage, inputChars, maxOutputTokens, timedOut } = input;
  const price = AI_MODEL_PRICING[model];
  if (price == null) {
    return Math.round(inputChars * HIGHEST_INPUT_PRICE + maxOutputTokens * HIGHEST_OUTPUT_PRICE);
  }
  if (usage == null) {
    return timedOut ? Math.round(inputChars * price.input) : 0;
  }
  return calculateUsageCost(usage, usage.inputTokens ?? inputChars, price);
}
