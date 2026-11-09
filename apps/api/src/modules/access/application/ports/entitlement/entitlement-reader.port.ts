import type { FeatureQuota } from "@aido/api";
import type { MeteredFeatureKey, PlanFeature, PlanLimitFeatureKey } from "@aido/api/vocabulary";

import type {
  AccessTier,
  FeatureAccess,
  FeatureUsageReading,
} from "../../../domain/policies/entitlement/entitlement.policy.js";

export type { AccessTier, FeatureAccess, FeatureUsageReading };

/** 소유 Context가 사용량·개수를 세는 한도 기능 (CHEER·NUDGE·FRIEND·TODO_CATEGORY) */
export type UnmeteredLimitFeatureKey = Exclude<PlanLimitFeatureKey, MeteredFeatureKey>;

/** 판단 시각의 권한 전체. 만료·자동 갱신 유예를 반영한다. */
export interface AccessSnapshot {
  readonly tier: AccessTier;
  /** 유효한 스토어 구독이나 보상 기간이 있는지. ADMIN role은 반영하지 않는다(tier·features가 반영한다). */
  readonly isPremium: boolean;
  readonly features: Readonly<Record<PlanFeature, FeatureAccess>>;
}

export const ENTITLEMENT_READER = Symbol("ENTITLEMENT_READER");

export interface EntitlementReaderPort {
  /** 카탈로그 기능을 쓸 수 있는지. quota·resource는 한도가 남았는지가 아니라 기능 자체의 허용 여부다. */
  can(userId: string, feature: PlanFeature): Promise<boolean>;
  /** 활성 UoW에서 캐시 없이 최신 상태로 다시 판단한다. 잠금 뒤 재확인에 쓴다. */
  canInTx(userId: string, feature: PlanFeature): Promise<boolean>;
  /** quota·resource 표시 한도(보너스 자리 포함). null은 무제한이다. */
  getLimit(userId: string, feature: PlanLimitFeatureKey): Promise<number | null>;
  getLimitInTx(userId: string, feature: PlanLimitFeatureKey): Promise<number | null>;
  /**
   * 한도 오류 details에 싣는 서버 계산 featureQuota. 활성 UoW에서 캐시 없이 최신 권한으로 계산한다.
   * usage는 소유 Context가 센 값이다(일간 quota는 X-Timezone 하루 사용량, resource는 현재 개수).
   */
  readFeatureQuotaInTx(
    userId: string,
    feature: UnmeteredLimitFeatureKey,
    usage: FeatureUsageReading,
  ): Promise<FeatureQuota>;
  getAccessSnapshot(userId: string): Promise<AccessSnapshot>;
}
