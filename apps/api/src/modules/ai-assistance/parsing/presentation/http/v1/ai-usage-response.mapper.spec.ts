import { PLAN_CATALOG } from "@aido/api/vocabulary";

import type { MeteredFeatureQuota } from "#api/modules/access/quotas/access-quotas.public";

import { toAiUsageData } from "./ai-usage-response.mapper.js";

function featureQuota(overrides: Partial<MeteredFeatureQuota>): MeteredFeatureQuota {
  return {
    feature: "AI_PARSE",
    allowed: true,
    limit: PLAN_CATALOG.AI_PARSE.free,
    used: 4,
    remaining: PLAN_CATALOG.AI_PARSE.free - 4,
    period: "month",
    resetsAt: "2026-04-30T15:00:00.000Z",
    isFairUse: false,
    perUse: null,
    ...overrides,
  };
}

describe("toAiUsageData — 출시 앱 /v1/ai/usage 모양", () => {
  it.each([
    { name: "무료", quota: featureQuota({}), limit: PLAN_CATALOG.AI_PARSE.free },
    {
      name: "프리미엄 공정 사용 상한",
      quota: featureQuota({ limit: PLAN_CATALOG.AI_PARSE.fairUse.premium, isFairUse: true }),
      limit: null,
    },
    { name: "ADMIN", quota: featureQuota({ limit: null, remaining: null }), limit: null },
  ])("$name 한도는 출시 앱이 알던 표시 한도 $limit 로 보인다", ({ quota, limit }) => {
    // When
    const usage = toAiUsageData(quota);

    // Then
    expect(usage).toEqual({ used: 4, limit, resetsAt: "2026-04-30T15:00:00.000Z" });
  });
});
