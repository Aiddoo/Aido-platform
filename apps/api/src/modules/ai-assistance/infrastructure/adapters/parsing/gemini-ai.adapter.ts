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

/**
 * 입력에 심은 지시로 유해한 문장을 할 일·리포트에 쓰게 하는 것을 공급자 단계에서도 막는다.
 * 일상 할 일("벌레 잡기")의 오탐으로 BLOCKED(AI_1302)가 늘지 않도록 확실한 경우(HIGH)만 막는다.
 */
const SAFETY_SETTINGS = (
  [
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
  ] as const
).map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" as const }));

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
      const result = await generateText({
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
            safetySettings: SAFETY_SETTINGS,
          } satisfies GoogleLanguageModelOptions,
        },
      });
      // 응답 후보가 safety로 막히면 SDK는 throw 없이 끝나고 output 접근에서야 실패한다.
      if (result.finishReason === "content-filter") {
        throw new AiProviderError("BLOCKED", undefined);
      }
      const { output, usage, finishReason } = result;

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
