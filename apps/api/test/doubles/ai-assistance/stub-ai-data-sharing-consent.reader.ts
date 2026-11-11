import {
  AI_DATA_SHARING_CONSENT,
  type AiDataSharingConsentVersion,
  type AiDataSharingDecision,
} from "@aido/api/vocabulary";

import {
  AiDataSharingConsent,
  AiDataSharingConsentReaderPort,
} from "#api/modules/identity/identity-settings.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 동의 시각은 테스트 시계보다 충분히 앞에 둔다. 시계 차 판정은 identity Entity 테스트가 맡는다
const AGREED_AT = Temporal.Instant.from("2020-01-01T00:00:00Z");

/** 사용자의 AI 데이터 처리 동의 상태를 테스트에서 바꿀 수 있는 identity 공개 포트 대역 */
export class StubAiDataSharingConsentReader extends AiDataSharingConsentReaderPort {
  decision: AiDataSharingDecision = "UNDECIDED";
  /** AGREED·DECLINED일 때 답한 안내 버전 */
  agreedVersion: AiDataSharingConsentVersion = AI_DATA_SHARING_CONSENT.VERSION;

  async findAiDataSharingConsent(userId: UserId): Promise<AiDataSharingConsent> {
    return AiDataSharingConsent.reconstitute({
      userId: userId.value,
      agreedAt: this.decision === "AGREED" ? AGREED_AT : null,
      version: this.decision === "UNDECIDED" ? null : this.agreedVersion,
    });
  }
}
