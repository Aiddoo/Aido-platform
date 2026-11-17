import type { AiProviderId } from "@aido/api/vocabulary";
import type { ConfigType } from "@nestjs/config";
import { pick } from "es-toolkit";

import { defineConfig } from "#api/platform/config/define-config";
import { AI_CONFIG_KEYS, aiSchema, toAiSettings } from "#api/platform/config/schemas/ai.schema";

/**
 * 체인 제한 시간을 나눌 때 업체가 받는 몫의 비율. 기준은 어떤 순서로 모두 멈춰도 각 업체가 자기 작업의 2026-11 live eval
 * 최댓값(parse-todo·quick-plan·digest: Claude 2.3·4.9·5.0초, Gemini 1.8·4.9·6.8초, OpenAI 4.8·5.2·6.2초)의 1.2배를
 * 받는 것이다. OpenAI만 두 배면 12·24·45초 체인에서 OpenAI 6·12·22.5초, 나머지 3·6·11.25초가 되어 이를 넘는다.
 */
const AI_PROVIDER_TIME_WEIGHTS: Readonly<Record<AiProviderId, number>> = {
  anthropic: 1,
  google: 1,
  openai: 2,
};

/**
 * AI 업체 키·순서·모델·시간 몫과 작업별 thinking·제한 시간, 회로, 킬 스위치, 비용 예산.
 * 키 목록을 schema에서 꺼내 고르므로 env를 더하면 읽기 함수를 따로 고치지 않는다. 바꾸면 재시작해야 반영된다.
 */
export const aiAssistanceAiGenerationsConfig = defineConfig(
  "aiAssistanceAiGenerations",
  aiSchema.transform((env) => ({
    ...toAiSettings(env),
    providerTimeWeights: AI_PROVIDER_TIME_WEIGHTS,
  })),
  (env) => pick(env, AI_CONFIG_KEYS),
);

export type AiAssistanceAiGenerationsConfig = ConfigType<typeof aiAssistanceAiGenerationsConfig>;
