import type { PlanFeature } from "@aido/api/vocabulary";

import type {
  AccessSubject,
  FeatureQuotaState,
  PlanComparison,
} from "../../../shared/domain/entitlement.domain-service.js";

/** 서버가 계산한 현재 권한·한도·사용량 전체(GET /v1/entitlements). 기능 순서는 PLAN_CATALOG 키 순서다. */
export interface EntitlementUsageReadModel extends AccessSubject {
  readonly features: Readonly<Record<PlanFeature, FeatureQuotaState>>;
  /** 기능마다 무료·프리미엄 요금제 값(받은 자리 없이) */
  readonly plans: Readonly<Record<PlanFeature, PlanComparison>>;
}
