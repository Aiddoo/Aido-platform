import type { ActionPlanReadModel } from "../../../action-plans/application/read-models/action-plan.read-model.js";

export interface VoiceNoteKeyPointReadModel {
  readonly text: string;
  /** 앱이 보낸 문장의 시각. AI가 고른 문장이 없거나 범위 밖이면 null이다 */
  readonly startMs: number | null;
}

/** 녹음 정리 결과. 전사 글자는 담지 않는다 */
export interface VoiceNoteDigestReadModel {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly VoiceNoteKeyPointReadModel[];
  readonly plan: ActionPlanReadModel;
}
