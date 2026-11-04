import type { AiDataSharingConsentStatus } from "../../../domain/services/settings/ai-data-sharing-consent-policy.js";

export const AI_DATA_SHARING_CONSENT_READER = Symbol("AI_DATA_SHARING_CONSENT_READER");

/** AI 기능을 가진 Context가 동의 테이블을 직접 읽지 않고 쓰는 공개 capability */
export interface AiDataSharingConsentReaderPort {
  findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsentStatus>;
}
