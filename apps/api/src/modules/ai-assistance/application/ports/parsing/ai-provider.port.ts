import type { z } from "zod";

export const AI_TASK_IDS = ["parse-todo", "parse-memo", "report", "suggestion"] as const;

/** 모델·정책·프롬프트 버전을 따로 고르는 AI 작업 단위. */
export type AiTaskId = (typeof AI_TASK_IDS)[number];

export const AI_THINKING_LEVELS = ["minimal", "low", "medium"] as const;

export type AiThinking = (typeof AI_THINKING_LEVELS)[number];

/** 작업별 생성 정책. maxOutputTokens는 사고 토큰을 포함한 상한이다. */
export interface AiGenerationPolicy {
  readonly thinking: AiThinking;
  readonly maxOutputTokens: number;
  /** 재시도를 포함한 전체 제한 시간 */
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
}

export interface GenerateStructuredOptions<T> {
  readonly task: AiTaskId;
  readonly promptVersion: string;
  readonly system: string;
  readonly prompt: string;
  readonly schema: z.ZodType<T>;
  readonly policy: AiGenerationPolicy;
  readonly signal?: AbortSignal;
}

export interface GenerateStructuredResult<T> {
  readonly output: T;
  readonly model: string;
  readonly finishReason: string;
  readonly latencyMs: number;
  readonly usage: TokenUsage;
}

export const AI_PROVIDER_ERROR_KINDS = [
  "UNAVAILABLE",
  "RATE_LIMITED",
  "TIMEOUT",
  "UPSTREAM",
  "BLOCKED",
  "TRUNCATED",
  "INVALID_OUTPUT",
] as const;

/** 공급자 실패를 응답 코드·재시도 판단에 필요한 종류로만 구분한다. */
export type AiProviderErrorKind = (typeof AI_PROVIDER_ERROR_KINDS)[number];

/** SDK/HTTP adapter가 분류해 전달하는 공급자 호출 실패. 원문 message는 담지 않는다. */
export class AiProviderError extends Error {
  constructor(
    readonly kind: AiProviderErrorKind,
    readonly statusCode: number | undefined,
    options?: ErrorOptions,
  ) {
    super(kind, options);
    this.name = AiProviderError.name;
  }
}

export interface AiProvider {
  generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>>;
  isAvailable(): boolean;
}

export const AI_PROVIDER = Symbol("AI_PROVIDER");
