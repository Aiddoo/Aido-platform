import type { LanguageModelUsage } from "ai";

import { estimateCostMicroUsd, estimateSpendMicroUsd } from "./ai-model-pricing.constants.js";

interface AttemptUsage {
  /** `<provider>:<model>` */
  readonly model: string;
  /** 업체가 알려 준 사용량. 실패해 모르면 undefined */
  readonly usage: LanguageModelUsage | undefined;
  readonly inputChars: number;
  readonly maxOutputTokens: number;
  readonly timedOut: boolean;
}

/**
 * 한 요청의 시도마다 사용량을 비용으로 바꿔 더한다. estimated는 응답·로그에 싣는 토큰 기준 값(단가를 모르면
 * null)이고, spend는 예산에 더하는 보수적 추정값이다. 체인이 실패해도 그때까지 쓴 비용을 예산에 더한다.
 */
export class AiGenerationCostMeter {
  #estimated: number | null = 0;
  #spend = 0;

  get estimatedMicroUsd(): number | null {
    return this.#estimated;
  }

  get spendMicroUsd(): number {
    return this.#spend;
  }

  addAttempt(attempt: AttemptUsage): void {
    const estimated = estimateCostMicroUsd(attempt.model, attempt.usage);
    this.#estimated =
      this.#estimated == null || estimated == null ? null : this.#estimated + estimated;
    this.#spend += estimateSpendMicroUsd(attempt);
  }
}
