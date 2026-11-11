import type { ConfigType } from "@nestjs/config";
import { pick } from "es-toolkit";

import { defineConfig } from "#api/platform/config/define-config";
import { AI_CONFIG_KEYS, aiSchema, toAiSettings } from "#api/platform/config/schemas/ai.schema";

/**
 * AI 업체 키·순서·모델과 작업별 thinking·제한 시간, 회로, 킬 스위치, 비용 예산.
 * 키 목록을 schema에서 꺼내 고르므로 env를 더하면 읽기 함수를 따로 고치지 않는다. 바꾸면 재시작해야 반영된다.
 */
export const aiAssistanceGenerationConfig = defineConfig(
  "aiAssistanceGeneration",
  // AiSettings는 interface라 index signature가 없어 namespace 값(Record)이 되도록 펼친다
  aiSchema.transform((env) => ({ ...toAiSettings(env) })),
  (env) => pick(env, AI_CONFIG_KEYS),
);

export type AiAssistanceGenerationConfig = ConfigType<typeof aiAssistanceGenerationConfig>;
