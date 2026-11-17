import type { ActionPlanReadModel } from "#api/modules/voice/plan-applications/voice-plan-applications.public";

interface VoiceDigestKeyPointReadModel {
  readonly text: string;
  /** 앱이 보낸 문장의 시각. AI가 고른 문장이 없거나 범위 밖이면 null이다 */
  readonly startMs: number | null;
}

/** 녹음 정리 결과. 전사 글자는 담지 않는다 */
export interface VoiceDigestReadModel {
  readonly title: string;
  readonly summary: string;
  readonly keyPoints: readonly VoiceDigestKeyPointReadModel[];
  readonly plan: ActionPlanReadModel;
}
