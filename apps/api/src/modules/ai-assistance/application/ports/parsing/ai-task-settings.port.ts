import type { AiTaskId, AiThinking } from "./ai-provider.port.js";

/** 작업별 프롬프트 폴더 버전. v1은 v2 롤백용으로만 남긴다. */
export type AiPromptVersion = "v1" | "v2";

/** 운영 설정(env)으로 작업마다 바꿀 수 있는 값. */
export interface AiTaskSettings {
  // TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
  readonly promptVersion: AiPromptVersion;
  readonly thinking: AiThinking;
}

export type AiTaskSettingsMap = Readonly<Record<AiTaskId, AiTaskSettings>>;

export const AI_TASK_SETTINGS = Symbol("AI_TASK_SETTINGS");
