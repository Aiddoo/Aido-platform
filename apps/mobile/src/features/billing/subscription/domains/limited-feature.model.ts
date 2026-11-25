import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { z } from 'zod';

import {
  type AccessDecision,
  entitlementFeatureSchema,
  featureQuotaSchema,
} from './feature-quota.model';

/** 서버가 한도·등급으로 막은 기능 하나 */
const limitedFeatureSchema = z.object({
  feature: entitlementFeatureSchema,
  /** 서버가 오류와 함께 준 현재 한도. 상세를 싣지 않는 코드는 null이다 */
  featureQuota: featureQuotaSchema.nullable(),
});
export type LimitedFeature = z.infer<typeof limitedFeatureSchema>;

export const LimitedFeaturePolicy = {
  /** 서버가 막은 기능의 오류가 한도 소진인지 등급 잠금인지. 서버가 한도를 함께 줬으면 그 값을 따른다 */
  getBlockedDecision(limited: LimitedFeature): Exclude<AccessDecision, 'allow'> {
    if (limited.featureQuota != null) {
      return limited.featureQuota.allowed ? 'limit-reached' : 'locked';
    }
    return PLAN_CATALOG[limited.feature].kind === 'flag' ? 'locked' : 'limit-reached';
  },
};
