import type { FactoryProvider } from "@nestjs/common";

import type { AiConfig } from "#api/platform/config/schemas/ai.schema";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import type { AiTaskId } from "../../../application/ports/parsing/ai-provider.port.js";
import {
  AI_TASK_SETTINGS,
  type AiTaskSettingsMap,
} from "../../../application/ports/parsing/ai-task-settings.port.js";

/** provider와 모델을 함께 쓴 AI SDK provider registry 모델 ID */
export type AiModelId = `${string}:${string}`;

/** 2026-10-26 live eval로 고른 가장 싼 충분한 모델. 네 작업 모두 같은 flash-lite를 쓴다. */
export const DEFAULT_AI_MODEL_ID: AiModelId = "google:gemini-3.1-flash-lite";

/** provider를 생략한 기존 env 값(`gemini-…`)은 지금까지처럼 Google 모델로 읽는다. */
export function toAiModelId(value: string): AiModelId {
  const separator = value.indexOf(":");
  return separator > 0
    ? `${value.slice(0, separator)}:${value.slice(separator + 1)}`
    : `google:${value}`;
}

const AI_TASK_ENV_SUFFIX = {
  "parse-todo": "PARSE_TODO",
  "parse-memo": "PARSE_MEMO",
  report: "REPORT",
  suggestion: "SUGGESTION",
} as const satisfies Record<AiTaskId, string>;

type AiTaskEnvSuffix = (typeof AI_TASK_ENV_SUFFIX)[AiTaskId];

/** env AI_MODEL_<TASK>가 없으면 기본 모델을 쓴다. */
export function readAiModelIds(env: Readonly<AiConfig>): Record<AiTaskId, AiModelId> {
  const model = (suffix: AiTaskEnvSuffix) => {
    const value = env[`AI_MODEL_${suffix}`];
    return value == null ? DEFAULT_AI_MODEL_ID : toAiModelId(value);
  };
  return {
    "parse-todo": model(AI_TASK_ENV_SUFFIX["parse-todo"]),
    "parse-memo": model(AI_TASK_ENV_SUFFIX["parse-memo"]),
    report: model(AI_TASK_ENV_SUFFIX.report),
    suggestion: model(AI_TASK_ENV_SUFFIX.suggestion),
  };
}

/** env AI_FALLBACK_MODEL. 없으면 대체 모델 없이 기본 모델만 쓴다. */
export function readAiFallbackModelId(env: Readonly<AiConfig>): AiModelId | null {
  const value = env.AI_FALLBACK_MODEL;
  return value == null ? null : toAiModelId(value);
}

export function readAiTaskSettings(env: Readonly<AiConfig>): AiTaskSettingsMap {
  const settings = (suffix: AiTaskEnvSuffix) => ({
    // TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
    promptVersion: env[`AI_PROMPT_VERSION_${suffix}`],
    thinking: env[`AI_THINKING_${suffix}`],
  });
  return {
    "parse-todo": settings(AI_TASK_ENV_SUFFIX["parse-todo"]),
    "parse-memo": settings(AI_TASK_ENV_SUFFIX["parse-memo"]),
    report: settings(AI_TASK_ENV_SUFFIX.report),
    suggestion: settings(AI_TASK_ENV_SUFFIX.suggestion),
  };
}

export const aiTaskSettingsProvider: FactoryProvider<AiTaskSettingsMap> = {
  provide: AI_TASK_SETTINGS,
  inject: [TypedConfigService],
  useFactory: (config: TypedConfigService) => readAiTaskSettings(config.ai),
};
