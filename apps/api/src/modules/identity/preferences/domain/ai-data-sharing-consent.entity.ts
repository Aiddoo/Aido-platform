import {
  AI_DATA_SHARING_CONSENT_VERSIONS,
  type AiDataSharingConsentVersion,
  type AiDataSharingDecision,
} from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { Entity } from "#api/shared/domain/model/entity";

export interface AiDataSharingConsentPrimitives {
  readonly userId: string;
  /** 현재 version 안내에 동의한 시각. 거부·철회했으면 null */
  readonly agreedAt: Temporal.Instant | null;
  /** 마지막으로 답한 안내 버전. 답한 적 없으면 null */
  readonly version: string | null;
}

interface AiDataSharingConsentProps {
  readonly agreedAt: Temporal.Instant | null;
  readonly version: string | null;
}

/** 동의 상태와 동의한 안내 버전. agreedVersion은 AGREED일 때만 있다 */
export interface AiDataSharingConsentStatus {
  readonly decision: AiDataSharingDecision;
  readonly agreedVersion: AiDataSharingConsentVersion | null;
}

/**
 * 사용자 데이터를 AI 처리 업체로 보내도 되는지에 대한 동의. HTTP guard·예약 작업·음성 계획이 같은 판정을 쓴다.
 * 지원하는 어느 버전에 동의했든 AGREED이고 그 버전이 허용한 업체만 쓴다(출시 앱 사용자에게 다시 묻지 않음).
 * 지원 목록에 없는 버전 동의는 다시 답해야 해 UNDECIDED, 거부·철회는 버전과 상관없이 DECLINED다.
 */
export class AiDataSharingConsent extends Entity<UserId, AiDataSharingConsentProps> {
  static reconstitute(primitives: AiDataSharingConsentPrimitives): AiDataSharingConsent {
    return new AiDataSharingConsent(UserId.reconstitute(primitives.userId), {
      agreedAt: primitives.agreedAt,
      version: primitives.version,
    });
  }

  static undecided(userId: string): AiDataSharingConsent {
    return AiDataSharingConsent.reconstitute({ userId, agreedAt: null, version: null });
  }

  /** 저장 행 그대로도 판정할 수 있게 시각의 있고 없음만 본다 */
  static statusOf(state: {
    readonly hasAgreed: boolean;
    readonly version: string | null;
  }): AiDataSharingConsentStatus {
    if (state.version == null) {
      return { decision: "UNDECIDED", agreedVersion: null };
    }
    if (!state.hasAgreed) {
      return { decision: "DECLINED", agreedVersion: null };
    }
    const agreedVersion =
      AI_DATA_SHARING_CONSENT_VERSIONS.find((version) => version === state.version) ?? null;
    return agreedVersion == null
      ? { decision: "UNDECIDED", agreedVersion: null }
      : { decision: "AGREED", agreedVersion };
  }

  status(): AiDataSharingConsentStatus {
    return AiDataSharingConsent.statusOf({
      hasAgreed: this.props.agreedAt != null,
      version: this.props.version,
    });
  }

  /**
   * now 시점에 AI로 보내도 되는지. requiredVersion은 보내려는 처리 업체를 처음 허용한 안내 버전이고,
   * 그보다 같거나 나중 버전에 동의했을 때만 true다. 동의 시각이 now보다 뒤면(시계 차) 아직 동의 전으로 본다.
   */
  allowsAiProcessingAt(
    now: Temporal.Instant,
    requiredVersion: AiDataSharingConsentVersion,
  ): boolean {
    const { decision, agreedVersion } = this.status();
    if (decision !== "AGREED" || agreedVersion == null || this.props.agreedAt == null) {
      return false;
    }
    const isAgreedBeforeNow = Temporal.Instant.compare(this.props.agreedAt, now) <= 0;
    const coversRequired =
      AI_DATA_SHARING_CONSENT_VERSIONS.indexOf(agreedVersion) >=
      AI_DATA_SHARING_CONSENT_VERSIONS.indexOf(requiredVersion);
    return isAgreedBeforeNow && coversRequired;
  }
}
