import type { SupportedLocale } from "#api/shared/domain/locale";

import type { AiGenerationMeta } from "../../../generation/application/ports/ai-generator.port.js";
import type { TodoRepeatRule } from "../../../shared/domain/todo-draft.constants.js";
import type { TranscriptSentence } from "../messages/voice-note-digest-prompt.messages.js";

export interface PlanningCategory {
  readonly id: number;
  readonly name: string;
}

export interface PlanningUpcomingTodo {
  readonly id: number;
  readonly title: string;
  readonly startDate: string;
  readonly isRepeating: boolean;
}

interface PlanGenerationInput {
  readonly userId: string;
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

/** 일정을 날짜·시각·반복으로 계산한 할 일. 적용 전까지 서버에 저장하지 않는다. */
export interface GeneratedTodo {
  readonly title: string;
  readonly categoryId: number | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledTime: string | null;
  readonly repeat: TodoRepeatRule | null;
  readonly visibility: "PRIVATE" | null;
  readonly items: readonly string[];
  readonly duplicateOfTodoId: number | null;
}

export interface GeneratedMemo {
  readonly title: string;
  readonly content: string;
}

export interface GeneratedActionPlan {
  readonly todos: readonly GeneratedTodo[];
  readonly memo: GeneratedMemo | null;
  readonly omittedTodoCount: number;
}

export interface PlanGenerationMeta extends AiGenerationMeta {
  readonly promptVersion: string;
}

export interface QuickPlanGeneration {
  readonly plan: GeneratedActionPlan;
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

/** 옛 토큰. voice가 클래스 토큰으로 옮기면 지운다(같은 인스턴스 별칭으로 바인딩) */
export const ACTION_PLAN_GENERATOR = Symbol("ACTION_PLAN_GENERATOR");
