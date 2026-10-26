import type {
  AiTaskSettings,
  AiTaskSettingsMap,
} from "#api/modules/ai-assistance/application/ports/parsing/ai-task-settings.port";

export const TEST_AI_TASK_SETTINGS: AiTaskSettings = { promptVersion: "v2", thinking: "low" };

/** v1 롤백 경로를 검증할 때 쓴다. */
export const TEST_AI_TASK_SETTINGS_V1: AiTaskSettings = { promptVersion: "v1", thinking: "low" };

/** 파싱만 v1으로 되돌린 앱 설정. 기존 v1 응답 fixture를 쓰는 e2e가 롤백 경로를 검증한다. */
export const TEST_AI_TASK_SETTINGS_MAP_PARSING_V1: AiTaskSettingsMap = {
  "parse-todo": TEST_AI_TASK_SETTINGS_V1,
  "parse-memo": TEST_AI_TASK_SETTINGS_V1,
  report: TEST_AI_TASK_SETTINGS,
  suggestion: TEST_AI_TASK_SETTINGS,
};
