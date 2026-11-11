import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { Inject, Injectable } from "@nestjs/common";

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

const SAFETY_BLOCK_PATTERN = /safety|input blocked|prohibited/i;
/** FAILED_PRECONDITION 400 중 요청이 아니라 결제(선불 잔액·결제 미설정) 문제인 경우 */
const BILLING_PATTERN = /billing|prepa(y|id)|credit|spending cap/i;
/**
 * RESOURCE_EXHAUSTED 429 중 잔액·지출 상한이 다 된 경우. 일반 한도 문구도
 * "check your plan and billing details"를 담으므로 billing 같은 낱말로 가르지 않는다.
 */
const SPEND_EXHAUSTED_PATTERN = /(prepa(y|id|yment)|credits?)\b[^.]*\bdepleted|spending cap/i;
const INVALID_KEY_PATTERN = /api key not valid|API_KEY_INVALID/i;

/** Gemini. 1.13·1.14 동의 사용자가 쓰는 유일한 업체. */
@Injectable()
export class GoogleProviderAdapter extends AiProviderAdapter {
  readonly id = "google";
  readonly dataHandling: AiProviderDataHandling = {
    trainsOnUserData: false,
    disablesResponseStorage: false,
    basis: "Gemini API 유료 등급 키: 프롬프트·응답을 제품 개선(학습)에 쓰지 않는다",
  };
  readonly #model: AiProviderModel | null;

  constructor(
    @Inject(aiAssistanceGenerationConfig.KEY)
    config: Pick<AiAssistanceGenerationConfig, "providers">,
  ) {
    super();
    const { apiKey, model } = config.providers.google;
    this.#model =
      apiKey == null
        ? null
        : { id: `${this.id}:${model}`, model: createGoogleGenerativeAI({ apiKey })(model) };
  }

  getModel(): AiProviderModel | null {
    return this.#model;
  }

  getProviderOptions(policy: AiGenerationPolicy): AiProviderOptions {
    return {
      google: {
        structuredOutputs: true,
        thinkingConfig: { thinkingLevel: policy.thinking },
        safetySettings: SAFETY_SETTINGS,
      } satisfies GoogleLanguageModelOptions,
    };
  }

  // Gemini는 같은 앞부분을 자동으로 캐시하므로 따로 표시하지 않는다.
  getSystemProviderOptions(): undefined {
    return undefined;
  }

  classifyError(error: unknown): AiFailureKind {
    return classifyAiSdkError(error, classifyGoogleResponse);
  }
}

function classifyGoogleResponse(
  statusCode: number | undefined,
  body: ProviderErrorBody,
): AiFailureKind {
  const message = body.message ?? "";
  const reasons = (body.details ?? []).map((detail) => detail.reason ?? "");
  if (statusCode === 429) {
    return SPEND_EXHAUSTED_PATTERN.test(message) ? "QUOTA_EXHAUSTED" : "RATE_LIMITED";
  }
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    INVALID_KEY_PATTERN.test(message) ||
    reasons.includes("API_KEY_INVALID")
  ) {
    return "AUTH";
  }
  if (statusCode === 400 && SAFETY_BLOCK_PATTERN.test(message)) {
    return "BLOCKED";
  }
  if (statusCode === 400 && BILLING_PATTERN.test(message)) {
    return "QUOTA_EXHAUSTED";
  }
  if (statusCode === 503 || body.status === "UNAVAILABLE") {
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
