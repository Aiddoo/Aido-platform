import type { AiDataSharingConsentVersion, AiDataSharingDecision } from "@aido/api/vocabulary";

export const AI_DATA_SHARING_CONSENT_DECISION_READER = Symbol(
  "AI_DATA_SHARING_CONSENT_DECISION_READER",
);

/** 동의 상태와 동의한 안내 버전. agreedVersion은 AGREED일 때만 있고 AI 처리 업체 범위를 정한다. */
export interface AiDataSharingConsent {
  readonly decision: AiDataSharingDecision;
  readonly agreedVersion: AiDataSharingConsentVersion | null;
}

/** AI 공급자로 사용자 데이터를 보내기 전에 identity의 AI 데이터 처리 동의 상태를 읽는다. */
export interface AiDataSharingConsentDecisionReaderPort {
  findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsent>;
}
