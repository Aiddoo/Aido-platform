import type { AiTaskSettings, AiThinking } from "#api/platform/config/schemas/ai.schema";

import type { AiTaskId } from "../../../application/ports/generation/ai-generator.port.js";

/** 한 요청의 생성 정책. maxOutputTokens는 사고 토큰을 포함한 상한이다. */
export interface AiGenerationPolicy {
  readonly thinking: AiThinking;
  readonly maxOutputTokens: number;
  /** 업체를 바꿔 가며 시도하는 전체 체인의 제한 시간 */
  readonly deadlineMs: number;
  /** 마지막 업체에서만 쓰는 SDK 재시도 횟수. 앞 업체는 바로 다음 업체로 넘긴다. */
  readonly lastProviderMaxRetries: number;
}

type TaskLimits = Pick<AiGenerationPolicy, "maxOutputTokens" | "lastProviderMaxRetries">;

/**
 * 작업별 생성 상한. 사고 토큰이 maxOutputTokens에 포함되므로 실제 출력보다 넉넉히 둔다.
 * 비용은 실제 생성량에만 비례하고, 잘린 출력은 TRUNCATED로 분류된다.
 */
const TASK_LIMITS: Readonly<Record<AiTaskId, TaskLimits>> = {
  "parse-todo": { maxOutputTokens: 1024, lastProviderMaxRetries: 1 },
  // 2026-10-26 live eval에서 긴 메모(할 일 12개)의 사고+출력이 최대 3,067 토큰이었다. 여유를 두 배로 둔다.
  "parse-memo": { maxOutputTokens: 6144, lastProviderMaxRetries: 1 },
  // 리포트·제안은 잡 재시도가 따로 있어 SDK 재시도는 짧게 유지한다.
  report: { maxOutputTokens: 2048, lastProviderMaxRetries: 2 },
  suggestion: { maxOutputTokens: 2048, lastProviderMaxRetries: 2 },
  // 할 일 최대 10개 + 메모 1개의 계획. parse-memo와 같은 여유를 둔다.
  "quick-plan": { maxOutputTokens: 6144, lastProviderMaxRetries: 1 },
  // 30분 녹음의 요약·핵심 포인트·계획(출력 약 1.5k 토큰)에 사고 토큰 여유를 더한다.
  "voice-note-digest": { maxOutputTokens: 8192, lastProviderMaxRetries: 1 },
};

export function resolveGenerationPolicy(
  task: AiTaskId,
  settings: AiTaskSettings,
): AiGenerationPolicy {
  return { ...TASK_LIMITS[task], ...settings };
}
