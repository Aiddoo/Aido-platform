/** 작업별 Gemini 모델·정책으로 구조화 출력을 AI SDK 7로 생성한다. */
import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { generateText, Output } from "ai";

import {
  type AiProvider,
  AiProviderError,
  type AiTaskId,
  type GenerateStructuredOptions,
  type GenerateStructuredResult,
} from "../../../application/ports/parsing/ai-provider.port.js";
import { readAiModelIds } from "../../config/parsing/ai-task-config.js";
import { classifyAiSdkError } from "./ai-sdk-error.classifier.js";

@Injectable()
export class GeminiAiAdapter implements AiProvider {
  readonly #google: ReturnType<typeof createGoogleGenerativeAI> | null;
  readonly #modelIds: Readonly<Record<AiTaskId, string>>;

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>("GOOGLE_GENERATIVE_AI_API_KEY");
    this.#google = apiKey == null || apiKey === "" ? null : createGoogleGenerativeAI({ apiKey });
    this.#modelIds = readAiModelIds(configService);
  }

  async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    if (this.#google == null) {
      throw new AiProviderError("UNAVAILABLE", undefined);
    }

    const modelId = this.#modelIds[options.task];
    const startedAt = performance.now();
    try {
      const { output, usage, finishReason } = await generateText({
        model: this.#google(modelId),
        ...(options.system !== "" && { instructions: options.system }),
        prompt: options.prompt,
        output: Output.object({ schema: options.schema }),
        maxOutputTokens: options.policy.maxOutputTokens,
        maxRetries: options.policy.maxRetries,
        timeout: { totalMs: options.policy.timeoutMs },
        abortSignal: options.signal,
        providerOptions: {
          google: {
            thinkingConfig: { thinkingLevel: options.policy.thinking },
          } satisfies GoogleLanguageModelOptions,
        },
      });

      return {
        output,
        model: `google:${modelId}`,
        finishReason,
        latencyMs: Math.round(performance.now() - startedAt),
        usage: {
          input: usage.inputTokens ?? 0,
          output: usage.outputTokens ?? 0,
          reasoning: usage.outputTokenDetails.reasoningTokens ?? 0,
        },
      };
    } catch (error) {
      throw classifyAiSdkError(error);
    }
  }

  isAvailable(): boolean {
    return this.#google != null;
  }
}
