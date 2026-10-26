import type { AiDataSharingDecision } from "@aido/api/vocabulary";

export const AI_DATA_SHARING_CONSENT_DECISION_READER = Symbol(
  "AI_DATA_SHARING_CONSENT_DECISION_READER",
);

/** AI 공급자로 사용자 데이터를 보내기 전에 identity의 AI 데이터 처리 동의 상태를 읽는다. */
export interface AiDataSharingConsentDecisionReaderPort {
  findAiDataSharingDecision(userId: string): Promise<AiDataSharingDecision>;
}
