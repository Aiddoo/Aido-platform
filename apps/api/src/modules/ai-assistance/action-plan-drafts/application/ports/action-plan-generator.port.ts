import type { SupportedLocale } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiGenerationMeta } from "../../../ai-generations/domain/ai-generation.aggregate.js";
import type { ActionPlanDraftPrimitives } from "../../domain/action-plan-draft.aggregate.js";
import type { TranscriptSentence } from "../messages/voice-note-digest-prompt.messages.js";

interface PlanningCategory {
  readonly id: number;
  readonly name: string;
}

interface PlanningUpcomingTodo {
  readonly id: number;
  readonly title: string;
  readonly startDate: string;
  readonly isRepeating: boolean;
}

interface PlanGenerationInput {
  readonly userId: UserId;
  readonly timezone: string;
  readonly locale: SupportedLocale;
  readonly categories: readonly PlanningCategory[];
  readonly upcomingTodos: readonly PlanningUpcomingTodo[];
  readonly signal?: AbortSignal;
}

export interface QuickPlanGenerationInput extends PlanGenerationInput {
  readonly text: string;
}

export interface VoiceNoteDigestGenerationInput extends PlanGenerationInput {
  readonly transcript: string;
  readonly sentences: readonly TranscriptSentence[];
}

interface PlanGenerationMeta extends AiGenerationMeta {
  readonly promptVersion: string;
}

export interface QuickPlanGeneration {
  readonly plan: ActionPlanDraftPrimitives;
  readonly meta: PlanGenerationMeta;
}

export interface VoiceNoteDigestGeneration extends QuickPlanGeneration {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly {
    readonly text: string;
    /** 프롬프트에 준 문장 번호. 호출자가 이 번호로 시각을 찾는다 */
    readonly sentenceIndex: number | null;
  }[];
  /** 요약·핵심 내용·계획이 모두 비어 돌려줄 내용이 없다 */
  readonly isEmpty: boolean;
}

/**
 * 말·글을 실행 계획으로 바꾼다. 동의한 범위의 업체만 쓰고, 생성 실패는 AI_1301·1302·1310으로 던진다.
 * 사용량 환불은 호출자가 소유하므로 오류에 차감 여부를 담지 않는다.
 */
export abstract class ActionPlanGeneratorPort {
  abstract generateQuickPlan(input: QuickPlanGenerationInput): Promise<QuickPlanGeneration>;
  abstract digestVoiceNote(
    input: VoiceNoteDigestGenerationInput,
  ): Promise<VoiceNoteDigestGeneration>;
}
