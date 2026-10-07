/** 고정 Gemini 모델의 구조화 출력을 AI SDK 7로 생성한다. */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APICallError, generateText, Output } from "ai";

import { ApplicationExceptions } from "#api/shared/application/exceptions/application-exceptions";

import type {
  AiProvider,
  GenerateStructuredOptions,
  GenerateStructuredResult,
} from "../../../application/ports/parsing/ai-provider.port.js";
import { AiProviderCallError } from "../../../application/ports/parsing/ai-provider.port.js";

const GEMINI_MODEL = "gemini-3.1-flash-lite" as const;
const DEFAULT_MAX_OUTPUT_TOKENS = 150;
const API_TIMEOUT_MS = 30_000;

@Injectable()
export class GeminiAiAdapter implements AiProvider {
  readonly #model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>> | null;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>("GOOGLE_GENERATIVE_AI_API_KEY");
    this.#model =
      apiKey === undefined || apiKey === null || apiKey === ""
        ? null
        : createGoogleGenerativeAI({ apiKey })(GEMINI_MODEL);
  }

  async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    if (this.#model === null) {
      throw ApplicationExceptions.aiServiceUnavailable();
    }

    try {
      const { output, usage } = await generateText({
        model: this.#model,
        // AI SDK v7: system → instructions (내부 포트의 system 필드를 매핑)
        ...(options.system && { instructions: options.system }),
        prompt: options.prompt,
        output: Output.object({ schema: options.schema }),
        maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      return {
        output,
        model: `google:${GEMINI_MODEL}`,
        usage: {
          input: usage.inputTokens ?? 0,
          output: usage.outputTokens ?? 0,
        },
      };
    } catch (error) {
      if (APICallError.isInstance(error) && error.statusCode === 429) {
        throw ApplicationExceptions.aiRateLimitExceeded();
      }
      if (APICallError.isInstance(error)) {
        throw new AiProviderCallError(error.message, error.statusCode, {
          cause: error,
        });
      }
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.#model !== null;
  }
}
