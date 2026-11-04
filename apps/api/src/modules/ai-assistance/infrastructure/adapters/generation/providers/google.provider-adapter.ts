import { createGoogleGenerativeAI, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { Injectable } from "@nestjs/common";

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
/** RESOURCE_EXHAUSTED·FAILED_PRECONDITION 중 분당 한도가 아니라 결제(선불 잔액·결제 미설정) 문제인 경우 */
const BILLING_PATTERN = /billing|prepa(y|id)|credit|spending cap/i;
const INVALID_KEY_PATTERN = /api key not valid|API_KEY_INVALID/i;

/** Gemini. 1.13·1.14 동의 사용자가 쓰는 유일한 업체. */
@Injectable()
export class GoogleProviderAdapter implements AiProviderAdapter {
  readonly id = "google";
  readonly #model: AiProviderModel | null;

  constructor(config: TypedConfigService) {
    const { apiKey, model } = config.ai.providers.google;
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
    return BILLING_PATTERN.test(message) ? "QUOTA_EXHAUSTED" : "RATE_LIMITED";
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
  if (statusCode != null && statusCode >= 400 && statusCode < 500) {
    return "BAD_REQUEST";
  }
  return "UPSTREAM";
}
