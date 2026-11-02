import type { PremiumFeature, PremiumLimitFeatureKey } from "@aido/api/vocabulary";

import type {
  AccessTier,
  Feature,
  FeatureAccess,
  Resource,
} from "../../../domain/policies/entitlement/entitlement-limits.policy.js";

export type { AccessTier, FeatureAccess };

export interface FeatureEntitlement {
  dailyLimit: number | null;
  isAdmin: boolean;
  subscriptionStatus: string;
}

export interface ResourceEntitlement {
  maxCount: number | null;
  isAdmin: boolean;
  subscriptionStatus: string;
}

/** 판단 시각의 권한 전체. 만료·자동 갱신 유예를 반영한다. */
export interface AccessSnapshot {
  readonly tier: AccessTier;
  /** 유효한 스토어 구독이나 보상 기간이 있는지. ADMIN role은 반영하지 않는다(tier·features가 반영한다). */
  readonly isPremium: boolean;
  readonly features: Readonly<Record<PremiumFeature, FeatureAccess>>;
}

export const ENTITLEMENT_READER = Symbol("ENTITLEMENT_READER");

export interface EntitlementReaderPort {
  getFeatureLimit(userId: string, feature: Feature): Promise<FeatureEntitlement>;
  getFeatureLimitInTx(userId: string, feature: Feature): Promise<FeatureEntitlement>;
  getResourceLimit(userId: string, resource: Resource): Promise<ResourceEntitlement>;
  getResourceLimitInTx(userId: string, resource: Resource): Promise<ResourceEntitlement>;
  calculateRemaining(dailyLimit: number | null, used: number): number | null;
  /** 카탈로그 기능을 쓸 수 있는지. quota·resource는 한도가 남았는지가 아니라 기능 자체의 허용 여부다. */
  can(userId: string, feature: PremiumFeature): Promise<boolean>;
  /** 활성 UoW에서 캐시 없이 최신 상태로 다시 판단한다. 잠금 뒤 재확인에 쓴다. */
  canInTx(userId: string, feature: PremiumFeature): Promise<boolean>;
  /** quota·resource 한도. null은 무제한이다. */
  limitOf(userId: string, feature: PremiumLimitFeatureKey): Promise<number | null>;
  limitOfInTx(userId: string, feature: PremiumLimitFeatureKey): Promise<number | null>;
  getAccessSnapshot(userId: string): Promise<AccessSnapshot>;
}
