import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
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

const BLOCKED_CODES = new Set(["content_filter", "content_policy_violation"]);

/** OpenAI(Responses API). 3순위. 크레딧 소진도 429로 오므로 code insufficient_quota로 구분한다. */
@Injectable()
export class OpenAiProviderAdapter implements AiProviderAdapter {
  readonly id = "openai";
  readonly #model: AiProviderModel | null;

  constructor(config: TypedConfigService) {
    const { apiKey, model } = config.ai.providers.openai;
    this.#model =
      apiKey == null ? null : { id: `${this.id}:${model}`, model: createOpenAI({ apiKey })(model) };
  }

  getModel(): AiProviderModel | null {
    return this.#model;
  }

  getProviderOptions(policy: AiGenerationPolicy): AiProviderOptions {
    return {
      openai: {
        // gpt-6-luna의 추론 강도는 none·low·medium…이다. minimal을 그대로 보내면 400이다.
        reasoningEffort: match(policy.thinking)
          .with("minimal", () => "none" as const)
          .with("low", () => "low" as const)
          .with("medium", () => "medium" as const)
          .exhaustive(),
        // 사용자 글자를 OpenAI 응답 저장소에 남기지 않는다.
        store: false,
        // 출력 schema는 업체 공통 규칙(모든 칸 required, 없을 수 있으면 null)을 따르므로 strict로 강제한다.
        strictJsonSchema: true,
      } satisfies OpenAILanguageModelResponsesOptions,
    };
  }

  // OpenAI는 1,024 토큰 이상 같은 앞부분을 자동으로 캐시하므로 따로 표시하지 않는다.
  getSystemProviderOptions(): undefined {
    return undefined;
  }

  classifyError(error: unknown): AiFailureKind {
    return classifyAiSdkError(error, classifyOpenAiResponse);
  }
}

function classifyOpenAiResponse(
  statusCode: number | undefined,
  body: ProviderErrorBody,
): AiFailureKind {
  if (body.code === "insufficient_quota" || body.type === "insufficient_quota") {
    return "QUOTA_EXHAUSTED";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "AUTH";
  }
  if (statusCode === 429) {
    return "RATE_LIMITED";
  }
  if (typeof body.code === "string" && BLOCKED_CODES.has(body.code)) {
    return "BLOCKED";
  }
  if (statusCode === 503) {
    return "OVERLOADED";
  }
  if (statusCode != null && statusCode >= 400 && statusCode < 500) {
    return "BAD_REQUEST";
  }
  return "UPSTREAM";
}
