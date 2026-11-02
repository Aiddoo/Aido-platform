import type { GoogleLanguageModelOptions } from "@ai-sdk/google";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APICallError, generateText, Output } from "ai";
import { createFallback } from "ai-fallback";

import {
  type AiProvider,
  AiProviderError,
  type AiTaskId,
  type GenerateStructuredOptions,
  type GenerateStructuredResult,
} from "../../../application/ports/parsing/ai-provider.port.js";
import { readAiFallbackModelId, readAiModelIds } from "../../config/parsing/ai-task-config.js";
import { AiProviderLogEvent } from "../../observability/parsing/ai-provider-log.events.js";
import {
  createAiModelRegistry,
  resolveAiModel,
  type ResolvedAiModel,
} from "./ai-model-registry.js";
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

/**
 * 공급자 일시 오류(429·5xx·네트워크)만 대체 모델로 넘긴다. 요청 오류·safety 차단·제한 시간 중단은
 * 다른 모델도 같게 실패하고, 출력 검증은 모델 호출 밖에서 일어나므로 대체 모델까지 오지 않는다.
 */
function shouldUseFallback(error: Error): boolean {
  return APICallError.isInstance(error) && error.isRetryable;
}

/**
 * 작업별 모델·정책으로 구조화 출력을 AI SDK로 생성한다. 모델은 `<provider>:<model>` env를
 * provider registry로 풀고, 대체 모델이 있으면 ai-fallback으로 묶는다.
 */
@Injectable()
export class AiSdkAdapter implements AiProvider {
  readonly #logger = new Logger(AiSdkAdapter.name);
  readonly #models: Readonly<Record<AiTaskId, ResolvedAiModel | null>>;
  readonly #fallback: ResolvedAiModel | null;

  constructor(configService: ConfigService) {
    const registry = createAiModelRegistry(configService);
    const modelIds = readAiModelIds(configService);
    this.#models = {
      "parse-todo": resolveAiModel(registry, modelIds["parse-todo"]),
      "parse-memo": resolveAiModel(registry, modelIds["parse-memo"]),
      report: resolveAiModel(registry, modelIds.report),
      suggestion: resolveAiModel(registry, modelIds.suggestion),
    };
    const fallbackId = readAiFallbackModelId(configService);
    this.#fallback = fallbackId == null ? null : resolveAiModel(registry, fallbackId);
    if (fallbackId != null && this.#fallback == null) {
      this.#logger.warn({ event: AiProviderLogEvent.MODEL_UNRESOLVED, model: fallbackId });
    }
  }

  async generateStructured<T>(
    options: GenerateStructuredOptions<T>,
  ): Promise<GenerateStructuredResult<T>> {
    const primary = this.#models[options.task];
    if (primary == null) {
      throw new AiProviderError("UNAVAILABLE", undefined);
    }
    const chain =
      this.#fallback == null || this.#fallback.id === primary.id
        ? [primary]
        : [primary, this.#fallback];
    // 요청마다 만들어 동시 요청끼리 현재 모델 상태를 나누지 않고, 항상 기본 모델부터 시도한다.
    const fallbackModel = createFallback({
      models: chain.map(({ model }) => model),
      shouldRetryThisError: shouldUseFallback,
      onError: (error) => {
        this.#logger.warn({
          event: AiProviderLogEvent.FALLBACK,
          task: options.task,
          model: chain[fallbackModel.currentModelIndex]?.id,
          statusCode: APICallError.isInstance(error) ? error.statusCode : undefined,
        });
      },
    });

    const startedAt = performance.now();
    try {
      const result = await generateText({
        model: chain.length === 1 ? primary.model : fallbackModel,
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
        model: (chain[fallbackModel.currentModelIndex] ?? primary).id,
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

  isAvailable(task: AiTaskId): boolean {
    return this.#models[task] != null;
  }
}
