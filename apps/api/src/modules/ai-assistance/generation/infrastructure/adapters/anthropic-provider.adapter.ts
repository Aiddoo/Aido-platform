import { type AnthropicLanguageModelOptions, createAnthropic } from "@ai-sdk/anthropic";
import { Inject, Injectable } from "@nestjs/common";
import { match } from "ts-pattern";

import {
  type AiAssistanceGenerationConfig,
  aiAssistanceGenerationConfig,
} from "../../ai-assistance-generation.config.js";
import type { AiFailureKind } from "../../application/ai-generation.errors.js";
import type { AiGenerationPolicy } from "./ai-generation-policy.constants.js";
import {
  AiProviderAdapter,
  type AiProviderDataHandling,
  type AiProviderModel,
  type AiProviderOptions,
} from "./ai-provider.adapter.js";
import { classifyAiSdkError, type ProviderErrorBody } from "./ai-sdk-failure.mapper.js";

/**
 * Claude Haiku 5.5의 최소 캐시 길이는 512토큰이다. 토큰 수는 호출 전에 알 수 없고 글자 수는 토큰 수보다
 * 크거나 비슷하므로, 이보다 짧은 지시문은 표시하지 않는다. 표시한 지시문이 최소 길이에 못 미쳐도 업체는
 * 오류나 추가 비용 없이 캐시만 하지 않는다.
 */
const MIN_CACHEABLE_SYSTEM_CHARACTERS = 512;

/** 크레딧 소진이 402 billing_error가 아니라 400 invalid_request_error로 오는 경우의 문구 */
const CREDIT_BALANCE_PATTERN = /credit balance is too low/i;

/** Claude. 1순위. 크레딧 소진은 402 billing_error나 400 문구로, 과부하는 529 overloaded_error로 온다. */
@Injectable()
export class AnthropicProviderAdapter extends AiProviderAdapter {
  readonly id = "anthropic";
  readonly dataHandling: AiProviderDataHandling = {
    trainsOnUserData: false,
    disablesResponseStorage: false,
    basis: "Anthropic API 상업 약관 기본값: API 입력·출력을 모델 학습에 쓰지 않는다",
  };
  readonly #model: AiProviderModel | null;

  constructor(
    @Inject(aiAssistanceGenerationConfig.KEY)
    config: Pick<AiAssistanceGenerationConfig, "providers">,
  ) {
    super();
    const { apiKey, model } = config.providers.anthropic;
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
  if (
    statusCode === 402 ||
    body.type === "billing_error" ||
    (statusCode === 400 && CREDIT_BALANCE_PATTERN.test(body.message ?? ""))
  ) {
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
  // 모델을 못 찾는 404는 입력이 아니라 우리 설정 문제다. 사용자에게 할 일 만들기 실패(AI_1302)로 답하지 않는다.
  if (statusCode === 404) {
    return "UPSTREAM";
  }
  if (statusCode != null && statusCode >= 400 && statusCode < 500) {
    return "BAD_REQUEST";
  }
  return "UPSTREAM";
}
