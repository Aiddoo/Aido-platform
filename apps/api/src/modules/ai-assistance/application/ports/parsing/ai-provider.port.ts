import type { z } from "zod";

export interface TokenUsage {
  readonly input: number;
  readonly output: number;
}

export interface GenerateStructuredOptions<T> {
  readonly system?: string;
  readonly prompt: string;
  readonly schema: z.ZodSchema<T>;
  readonly maxOutputTokens?: number;
}

export interface GenerateStructuredResult<T> {
  readonly output: T;
  readonly model: string;
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
