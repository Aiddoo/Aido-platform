import type {
  AccessTier,
  MeteredFeatureKey,
  Plan,
  PlanFeature,
  PlanLimitFeatureKey,
} from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { FeatureEntitlement } from "../../domain/entitlement.domain-service.js";
import type { FeatureQuotaDetails } from "../read-models/feature-quota.read-model.js";

export type { FeatureEntitlement };

/** 소유 Context가 사용량·개수를 세는 한도 기능 (CHEER·NUDGE·FRIEND·TODO_CATEGORY) */
export type UnmeteredLimitFeatureKey = Exclude<PlanLimitFeatureKey, MeteredFeatureKey>;

/** 소유 Context가 센 사용량. 다른 Context가 아직 Date를 쓰므로 이 경계에서 받는다. */
export interface ReportedFeatureUsage {
  readonly used: number;
  readonly resetsAt: Date | null;
}

/** 판단 시각의 권한 전체. 만료·자동 갱신 유예를 반영한다. */
export interface UserEntitlements {
  /** 누구인가(출시 앱 표시). 기능 판단에는 plan을 쓴다. */
  readonly tier: AccessTier;
  /** 기능 값을 정한 요금제. ADMIN은 premium이다. */
  readonly plan: Plan;
  /** 유효한 스토어 구독이나 보상 기간이 있는지(결제 사실). ADMIN role은 반영하지 않는다. */
  readonly isPremium: boolean;
  readonly features: Readonly<Record<PlanFeature, FeatureEntitlement>>;
}

/** 다른 Context가 권한을 묻는 문. 역할·구독 상태가 허용하는 것은 access 도메인 서비스가 판단한다. */
export abstract class EntitlementReaderPort {
  /** 카탈로그 기능을 쓸 수 있는지. quota·resource는 한도가 남았는지가 아니라 기능 자체의 허용 여부다. */
  abstract can(userId: UserId, feature: PlanFeature): Promise<boolean>;
  /** 활성 UoW에서 캐시 없이 최신 상태로 다시 판단한다. 잠금 뒤 재확인에 쓴다. */
  abstract canInTx(userId: UserId, feature: PlanFeature): Promise<boolean>;
  /** quota·resource 표시 한도(받은 자리 포함). null은 무제한이다. */
  abstract getFeatureLimit(userId: UserId, feature: PlanLimitFeatureKey): Promise<number | null>;
  abstract getFeatureLimitInTx(
    userId: UserId,
    feature: PlanLimitFeatureKey,
  ): Promise<number | null>;
  /**
   * 한도 오류 details에 싣는 서버 계산 featureQuota. 활성 UoW에서 캐시 없이 최신 권한으로 계산한다.
   * usage는 소유 Context가 센 값이다(일간 quota는 X-Timezone 하루 사용량, resource는 현재 개수).
   */
  abstract getFeatureQuotaInTx(
    userId: UserId,
    feature: UnmeteredLimitFeatureKey,
    usage: ReportedFeatureUsage,
  ): Promise<FeatureQuotaDetails>;
  abstract getEntitlements(userId: UserId): Promise<UserEntitlements>;
}
