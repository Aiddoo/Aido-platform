import type { AiTaskSettings, AiThinking } from "#api/platform/config/schemas/ai.schema";

import type { AiTaskId } from "../../application/ports/ai-generator.port.js";
import type { AiTaskClass } from "../../domain/ai-spend.domain-service.js";

/** 한 요청의 생성 정책. maxOutputTokens는 사고 토큰을 포함한 상한이다. */
export interface AiGenerationPolicy {
  readonly thinking: AiThinking;
  readonly maxOutputTokens: number;
  /** 업체를 바꿔 가며 시도하는 전체 체인의 제한 시간 */
  readonly deadlineMs: number;
  /** 마지막 업체에서만 쓰는 SDK 재시도 횟수. 앞 업체는 바로 다음 업체로 넘긴다. */
  readonly lastProviderMaxRetries: number;
  /** 한 요청에서 모델을 부르는 최대 횟수(대체 업체·출력 재질문 포함, SDK 내부 재시도 제외) */
  readonly maxModelCalls: number;
}

/**
 * 작업별 생성 상한. 사고 토큰이 maxOutputTokens에 포함되므로 실제 출력보다 넉넉히 둔다.
 * 비용은 실제 생성량에만 비례하고, 잘린 출력은 TRUNCATED로 분류된다.
 */
const TASK_MAX_OUTPUT_TOKENS: Readonly<Record<AiTaskId, number>> = {
  "parse-todo": 1024,
  // 2026-10-26 live eval에서 긴 메모(할 일 12개)의 사고+출력이 최대 3,067 토큰이었다. 여유를 두 배로 둔다.
  "parse-memo": 6144,
  report: 2048,
  suggestion: 2048,
  // 할 일 최대 10개 + 메모 1개의 계획. parse-memo와 같은 여유를 둔다.
  "quick-plan": 6144,
  // 30분 녹음의 요약·핵심 포인트·계획(출력 약 1.5k 토큰)에 사고 토큰 여유를 더한다.
  "voice-note-digest": 8192,
};

/** 재시도 층은 하나다. 배경 작업은 pg-boss가 다시 부르므로 SDK 재시도를 쓰지 않고 모델 호출도 더 적게 둔다. */
const CLASS_LIMITS: Readonly<
  Record<AiTaskClass, Pick<AiGenerationPolicy, "lastProviderMaxRetries" | "maxModelCalls">>
> = {
  interactive: { lastProviderMaxRetries: 1, maxModelCalls: 4 },
  background: { lastProviderMaxRetries: 0, maxModelCalls: 3 },
};

export function resolveGenerationPolicy(
  task: AiTaskId,
  taskClass: AiTaskClass,
  settings: AiTaskSettings,
): AiGenerationPolicy {
  return { maxOutputTokens: TASK_MAX_OUTPUT_TOKENS[task], ...CLASS_LIMITS[taskClass], ...settings };
}
