import { createOpenAI, type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { Inject, Injectable } from "@nestjs/common";
import { match } from "ts-pattern";
import { z } from "zod";

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

const BLOCKED_CODES = new Set(["content_filter", "content_policy_violation"]);

/** 모델 거절은 200 응답의 refusal 조각으로 온다. SDK 응답 schema는 이 조각을 몰라 APICallError로 던진다. */
const refusalResponseSchema = z.object({
  output: z.array(z.object({ content: z.array(z.object({ type: z.string() })).optional() })),
});

function hasRefusal(responseBody: string | undefined): boolean {
  if (responseBody == null) {
    return false;
  }
  try {
    const parsed = refusalResponseSchema.safeParse(JSON.parse(responseBody));
    return (
      parsed.success &&
      parsed.data.output.some((item) => item.content?.some((part) => part.type === "refusal"))
    );
  } catch {
    return false;
  }
}

/** OpenAI(Responses API). 3순위. 크레딧 소진도 429로 오므로 code insufficient_quota로 구분한다. */
@Injectable()
export class OpenAiProviderAdapter extends AiProviderAdapter {
  readonly id = "openai";
  readonly dataHandling: AiProviderDataHandling = {
    trainsOnUserData: false,
    disablesResponseStorage: true,
    basis: "OpenAI API 기본값: API 입력·출력을 모델 학습에 쓰지 않는다",
  };
  readonly #model: AiProviderModel | null;

  constructor(
    @Inject(aiAssistanceGenerationConfig.KEY)
    config: Pick<AiAssistanceGenerationConfig, "providers">,
  ) {
    super();
    const { apiKey, model } = config.providers.openai;
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
        // 사용자 글자를 OpenAI 응답 저장소에 남기지 않는다(dataHandling 선언과 같은 값).
        store: !this.dataHandling.disablesResponseStorage,
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
  responseBody: string | undefined,
): AiFailureKind {
  if (statusCode === 200 && hasRefusal(responseBody)) {
    return "BLOCKED";
  }
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
  // 모델을 못 찾는 404는 입력이 아니라 우리 설정 문제다. 사용자에게 할 일 만들기 실패(AI_1302)로 답하지 않는다.
  if (statusCode === 404) {
    return "UPSTREAM";
  }
  if (statusCode != null && statusCode >= 400 && statusCode < 500) {
    return "BAD_REQUEST";
  }
  return "UPSTREAM";
}
