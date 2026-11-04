import { type AnthropicLanguageModelOptions, createAnthropic } from "@ai-sdk/anthropic";
import { Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { AiFailureKind } from "../../../../application/ports/generation/ai-generation.errors.js";
import type { AiGenerationPolicy } from "../ai-generation-policy.js";
import type {
  AiProviderAdapter,
  AiProviderModel,
  AiProviderOptions,
} from "./ai-provider-adapter.js";
import { classifyAiSdkError, type ProviderErrorBody } from "./ai-sdk-failure.js";

/**
 * Claude Haiku 5.5의 최소 캐시 길이는 512토큰이다. 토큰 수는 호출 전에 알 수 없고 글자 수는 토큰 수보다
 * 크거나 비슷하므로, 이보다 짧은 지시문은 표시하지 않는다. 표시한 지시문이 최소 길이에 못 미쳐도 업체는
 * 오류나 추가 비용 없이 캐시만 하지 않는다.
 */
const MIN_CACHEABLE_SYSTEM_CHARACTERS = 512;

/** Claude. 1순위. 크레딧 소진은 HTTP 402 billing_error, 과부하는 529 overloaded_error로 온다. */
@Injectable()
export class AnthropicProviderAdapter implements AiProviderAdapter {
  readonly id = "anthropic";
  readonly #model: AiProviderModel | null;

  constructor(config: TypedConfigService) {
    const { apiKey, model } = config.ai.providers.anthropic;
    this.#model =
      apiKey == null
        ? null
        : { id: `${this.id}:${model}`, model: createAnthropic({ apiKey })(model) };
  }

  getModel(): AiProviderModel | null {
    return this.#model;
  }

  getProviderOptions(policy: AiGenerationPolicy): AiProviderOptions {
    return {
      anthropic: {
        // 네이티브 구조화 출력은 null 허용 칸을 16개까지만 받는다(parse-todo는 29개라 400, 실측).
        // SDK의 JSON 도구 방식으로 받고 출력은 서버 Zod schema가 다시 검증한다.
        structuredOutputMode: "jsonTool",
        effort: match(policy.thinking)
          .with("minimal", "low", () => "low" as const)
          .with("medium", () => "medium" as const)
          .exhaustive(),
        // 가장 가벼운 단계는 추론을 꺼 출력 토큰을 줄인다(Haiku 5.5는 effort high 이하에서 끌 수 있다).
        ...(policy.thinking === "minimal" && { thinking: { type: "disabled" as const } }),
      } satisfies AnthropicLanguageModelOptions,
    };
  }

  getSystemProviderOptions(system: string): AiProviderOptions | undefined {
    if (system.length < MIN_CACHEABLE_SYSTEM_CHARACTERS) {
      return undefined;
    }
    return { anthropic: { cacheControl: { type: "ephemeral" } } };
  }

  classifyError(error: unknown): AiFailureKind {
    return classifyAiSdkError(error, classifyAnthropicResponse);
  }
}

function classifyAnthropicResponse(
  statusCode: number | undefined,
  body: ProviderErrorBody,
): AiFailureKind {
  if (statusCode === 402 || body.type === "billing_error") {
    return "QUOTA_EXHAUSTED";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "AUTH";
  }
  if (statusCode === 429) {
    return "RATE_LIMITED";
  }
  if (statusCode === 529 || body.type === "overloaded_error") {
    return "OVERLOADED";
  }
  if (statusCode != null && statusCode >= 400 && statusCode < 500) {
    return "BAD_REQUEST";
  }
  return "UPSTREAM";
}
