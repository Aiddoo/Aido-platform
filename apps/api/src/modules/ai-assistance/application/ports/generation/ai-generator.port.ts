import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";
import type { AiProviderId } from "@aido/api/vocabulary";
import type { z } from "zod";

export const AI_TASK_IDS = [
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
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly reasoningTokens: number;
  /** 모든 시도의 토큰 × 모델 단가. 단가를 모르는 모델을 썼으면 null */
  readonly estimatedCostMicroUsd: number | null;
  readonly finishReason: string;
}

export type AiGenerationMeta = Omit<AiGenerationResult<unknown>, "output">;

/** 설정 순서·동의 범위·회로 상태로 고른 업체를 차례로 시도해 스키마에 맞는 출력을 만든다. */
export interface AiGeneratorPort {
  generate<T>(request: AiGenerationRequest<T>): Promise<AiGenerationResult<T>>;
}

export const AI_GENERATOR = Symbol("AI_GENERATOR");
