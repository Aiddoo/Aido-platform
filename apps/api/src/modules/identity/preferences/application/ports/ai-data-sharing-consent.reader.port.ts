import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AiDataSharingConsent } from "../../domain/ai-data-sharing-consent.entity.js";

/** AI 기능을 가진 Context가 동의 테이블을 직접 읽지 않고 쓰는 공개 capability. 판정은 Entity의 allowsAiProcessingAt이다 */
export abstract class AiDataSharingConsentReaderPort {
  abstract findAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent>;
}
