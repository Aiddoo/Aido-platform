import type { AccessTier, Plan, PlanFeature } from "@aido/api/vocabulary";

import type { FeatureEntitlement } from "../../../shared/domain/entitlement.domain-service.js";

/** 판단 시각의 권한 전체. 만료·자동 갱신 유예를 반영한다. */
export interface UserEntitlementsReadModel {
  /** 누구인가(출시 앱 표시). 기능 판단에는 plan을 쓴다. */
  readonly tier: AccessTier;
  /** 기능 값을 정한 요금제. ADMIN은 premium이다. */
  readonly plan: Plan;
  /** 유효한 스토어 구독이나 보상 기간이 있는지(결제 사실). ADMIN role은 반영하지 않는다. */
  readonly isPremium: boolean;
  readonly features: Readonly<Record<PlanFeature, FeatureEntitlement>>;
}
