import type { PlanFeature } from "@aido/api/vocabulary";

import type { AccessSubject, FeatureQuotaState } from "../../domain/entitlement.domain-service.js";

/** 서버가 계산한 현재 권한 전체(GET /v1/entitlements). 기능 순서는 PLAN_CATALOG 키 순서다. */
export interface EntitlementSnapshot extends AccessSubject {
  readonly features: Readonly<Record<PlanFeature, FeatureQuotaState>>;
}
