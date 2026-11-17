import type { AiDataSharingConsentVersion } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  QuickPlanDraft,
  VoiceNoteDigestDraft,
} from "../../../action-plan-drafts/domain/action-plan-drafts.constants.js";
import type { ReportDraft } from "../../../ai-reports/domain/ai-reports.constants.js";
import type { MemoDraft } from "../../../parsed-drafts/domain/parsed-drafts.constants.js";
import type { TodoDraft } from "../../../shared/domain/todo-draft.constants.js";
import type { SuggestionDraft } from "../../../suggestions/domain/suggestions.constants.js";
import type { AiGeneration } from "../../domain/ai-generation.aggregate.js";
import type { AiTaskClass } from "../../domain/ai-spend.domain-service.js";

/** 모델 정책·제한 시간·프롬프트를 따로 고르는 AI 작업 단위와 그 작업의 모델 출력(업체 중립 모양) */
export interface AiTaskOutputs {
  readonly "parse-todo": TodoDraft;
  readonly "parse-memo": MemoDraft;
  readonly report: ReportDraft;
  readonly suggestion: SuggestionDraft;
  readonly "quick-plan": QuickPlanDraft;
  readonly "voice-note-digest": VoiceNoteDigestDraft;
}

export type AiTaskId = keyof AiTaskOutputs;

export interface AiGenerationRequest<TTask extends AiTaskId> {
  readonly task: TTask;
  readonly taskClass: AiTaskClass;
  /** 비용을 사용자별 일 예산에 더할 사용자. 시스템 호출이면 null */
  readonly userId: UserId | null;
  /** user 턴(prompt) 글자 상한. 넘으면 업체를 부르지 않고 BAD_REQUEST로 끝낸다. */
  readonly maxInputChars: number;
  readonly promptVersion: string;
  readonly system: string;
  readonly prompt: string;
  /** 사용자가 동의한 AI 데이터 처리 안내 버전. 처리 업체 범위를 정한다(없으면 Google만). */
  readonly agreedConsentVersion: AiDataSharingConsentVersion | null;
  readonly signal?: AbortSignal;
}

/**
 * 킬 스위치·예산·입력 상한을 먼저 확인하고, 설정 순서·동의 범위·회로 상태로 고른 업체를 차례로
 * 시도해 작업의 출력 모양에 맞는 생성을 만든다.
 */
export abstract class AiGeneratorPort {
  abstract generate<TTask extends AiTaskId>(
    request: AiGenerationRequest<TTask>,
  ): Promise<AiGeneration<AiTaskOutputs[TTask]>>;
}
