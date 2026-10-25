import type { AiTaskId, AiThinking } from "./ai-provider.port.js";

/** 운영 설정(env)으로 작업마다 바꿀 수 있는 값. */
export interface AiTaskSettings {
  readonly thinking: AiThinking;
}

export type AiTaskSettingsMap = Readonly<Record<AiTaskId, AiTaskSettings>>;

export const AI_TASK_SETTINGS = Symbol("AI_TASK_SETTINGS");
