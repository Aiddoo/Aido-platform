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
 * 이보다 짧은 지시문은 Claude 최소 캐시 길이(토큰)에 못 미쳐 캐시되지 않으므로 표시하지 않는다.
 * 글자 수는 토큰 수보다 크거나 비슷하므로 글자 수로 먼저 거른다.
 */
const MIN_CACHEABLE_SYSTEM_CHARACTERS = 4096;

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
        effort: match(policy.thinking)
          .with("minimal", "low", () => "low" as const)
          .with("medium", () => "medium" as const)
          .exhaustive(),
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
