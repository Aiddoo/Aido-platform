import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";
import type { AiProviderId } from "@aido/api/vocabulary";
import type { z } from "zod";

import type { AiTaskClass } from "../../domain/ai-spend.domain-service.js";

const AI_TASK_IDS = [
  "parse-todo",
  "parse-memo",
  "report",
  "suggestion",
  "quick-plan",
  "voice-note-digest",
] as const;

/** 모델 정책·제한 시간·프롬프트를 따로 고르는 AI 작업 단위. */
export type AiTaskId = (typeof AI_TASK_IDS)[number];

export interface AiGenerationRequest<T> {
  readonly task: AiTaskId;
  readonly taskClass: AiTaskClass;
  /** 비용을 사용자별 일 예산에 더할 사용자. 시스템 호출이면 null */
  readonly userId: string | null;
  /** user 턴(prompt) 글자 상한. 넘으면 업체를 부르지 않고 BAD_REQUEST로 끝낸다. */
  readonly maxInputChars: number;
  readonly promptVersion: string;
  readonly system: string;
  readonly prompt: string;
  readonly schema: z.ZodType<T>;
  /** 사용자가 동의한 AI 데이터 처리 안내 버전. 처리 업체 범위를 정한다(없으면 Google만). */
  readonly agreedConsentVersion: AiDataSharingConsentVersion | null;
  readonly signal?: AbortSignal;
}

/** 성공한 생성. 토큰은 응답한 호출의 값이고, 비용은 이 요청의 모든 시도를 더한 추정값이다. */
export interface AiGenerationResult<T> {
  readonly output: T;
  readonly provider: AiProviderId;
  /** `<provider>:<model>` (예: anthropic:claude-haiku-5-5) */
  readonly model: string;
  /** 모델을 부른 횟수(대체 업체·출력 재시도 포함) */
  readonly attempts: number;
  /** 첫 업체가 실패해 다른 업체가 응답했으면 첫 업체 */
  readonly fallbackFrom: AiProviderId | null;
  readonly latencyMs: number;
  /** 입력 토큰 전체(캐시 읽기·쓰기 포함) */
  readonly inputTokens: number;
  /** 입력 토큰 중 프롬프트 캐시에서 읽은 수 */
  readonly cachedInputTokens: number;
  /** 입력 토큰 중 프롬프트 캐시에 새로 쓴 수 */
  readonly cacheWriteInputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  /** 모든 시도의 토큰 × 모델 단가. 단가를 모르는 모델을 썼으면 null */
  readonly estimatedCostMicroUsd: number | null;
  readonly finishReason: string;
}

export type AiGenerationMeta = Omit<AiGenerationResult<unknown>, "output">;

/**
 * 킬 스위치·예산·입력 상한을 먼저 확인하고, 설정 순서·동의 범위·회로 상태로 고른 업체를 차례로
 * 시도해 스키마에 맞는 출력을 만든다.
 */
export abstract class AiGeneratorPort {
  abstract generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>>;
}
