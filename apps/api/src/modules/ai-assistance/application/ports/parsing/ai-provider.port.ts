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

/** SDK/HTTP adapter가 전달하는 공급자 호출 실패. */
export class AiProviderCallError extends Error {
  constructor(
    message: string,
    readonly statusCode: number | undefined,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = AiProviderCallError.name;
  }
}

export interface AiProvider {
  generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>>;
  isAvailable(): boolean;
}

export const AI_PROVIDER = Symbol("AI_PROVIDER");
