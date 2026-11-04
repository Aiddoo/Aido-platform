/** 작업별 프롬프트 폴더 버전. v1은 v2 롤백용으로만 남긴다. */
export type AiPromptVersion = "v1" | "v2";

/** 운영 설정(env)으로 작업마다 바꿀 수 있는 값. 모델·추론 강도·제한 시간은 생성기가 설정에서 읽는다. */
export interface AiTaskSettings {
  // TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
  readonly promptVersion: AiPromptVersion;
}

export type AiTaskSettingsMap = Readonly<
  Record<"parse-todo" | "parse-memo" | "report" | "suggestion", AiTaskSettings>
>;

export const AI_TASK_SETTINGS = Symbol("AI_TASK_SETTINGS");
