import type { GrantableFeature } from "@aido/api/vocabulary";

/** 기능별로 받은 자리 합계(초대 보상 등). 키가 없으면 0이다. */
export type FeatureGrants = Readonly<Partial<Record<GrantableFeature, number>>>;

export const NO_FEATURE_GRANTS: FeatureGrants = {};
