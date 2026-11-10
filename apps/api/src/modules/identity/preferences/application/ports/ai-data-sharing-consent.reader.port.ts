import type { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";

/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const AI_DATA_SHARING_CONSENT_READER = Symbol("AI_DATA_SHARING_CONSENT_READER");

/** AI 기능을 가진 Context가 동의 테이블을 직접 읽지 않고 쓰는 공개 capability. 판정은 Entity의 allowsAiProcessingAt이다 */
export abstract class AiDataSharingConsentReaderPort {
  abstract findAiDataSharingConsent(userId: string): Promise<AiDataSharingConsent>;
}
