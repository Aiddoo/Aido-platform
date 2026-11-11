import type { AiUsageData } from "@aido/api";

import type { MeteredFeatureQuota } from "#api/modules/access/quotas/access-quotas.public";

/**
 * 출시 앱(1.13·1.14) GET /v1/ai/usage 모양. 프리미엄의 공정 사용 상한은 보여 주지 않고 무제한(null)으로
 * 보인다. 1.15.0부터 앱은 GET /v1/entitlements와 응답의 featureQuota를 읽는다.
 */
export function toAiUsageData(quota: MeteredFeatureQuota): AiUsageData {
  return {
    used: quota.used,
    limit: quota.isFairUse ? null : quota.limit,
    resetsAt: quota.resetsAt,
  };
}
