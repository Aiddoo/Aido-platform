import type { FactoryProvider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { aiSchema } from "#api/platform/config/schemas/ai.schema";

import type { AiTaskId } from "../../../application/ports/parsing/ai-provider.port.js";
import {
  AI_TASK_SETTINGS,
  type AiTaskSettingsMap,
} from "../../../application/ports/parsing/ai-task-settings.port.js";

export const DEFAULT_AI_MODEL_ID = "gemini-3.1-flash-lite";

const AI_TASK_ENV_SUFFIX = {
  "parse-todo": "PARSE_TODO",
  "parse-memo": "PARSE_MEMO",
  report: "REPORT",
  suggestion: "SUGGESTION",
} as const satisfies Record<AiTaskId, string>;

type AiTaskEnvSuffix = (typeof AI_TASK_ENV_SUFFIX)[AiTaskId];

function readAiConfig(config: Pick<ConfigService, "get">) {
  const keys = Object.keys(aiSchema.shape);
  return aiSchema.parse(Object.fromEntries(keys.map((key) => [key, config.get(key)])));
}

/** env AI_MODEL_<TASK>가 없으면 기본 모델을 쓴다. */
export function readAiModelIds(config: Pick<ConfigService, "get">): Record<AiTaskId, string> {
  const env = readAiConfig(config);
  const model = (suffix: AiTaskEnvSuffix) => env[`AI_MODEL_${suffix}`] ?? DEFAULT_AI_MODEL_ID;
  return {
    "parse-todo": model(AI_TASK_ENV_SUFFIX["parse-todo"]),
    "parse-memo": model(AI_TASK_ENV_SUFFIX["parse-memo"]),
    report: model(AI_TASK_ENV_SUFFIX.report),
    suggestion: model(AI_TASK_ENV_SUFFIX.suggestion),
  };
}

export function readAiTaskSettings(config: Pick<ConfigService, "get">): AiTaskSettingsMap {
  const env = readAiConfig(config);
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
  inject: [ConfigService],
  useFactory: (config: ConfigService) => readAiTaskSettings(config),
};
