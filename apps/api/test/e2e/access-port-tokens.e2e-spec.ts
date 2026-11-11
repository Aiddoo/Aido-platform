import {
  EntitlementCacheInvalidatorPort,
  EntitlementReaderPort,
  FeatureGranterPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import { EntitlementCachePort } from "#api/modules/access/entitlements/application/ports/entitlement-cache.port";
import { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

// 다른 Context는 access 포트를 클래스 토큰 하나로만 받는다. 캐시 비우기가 권한 캐시와 다른 인스턴스면
// 구독·보상·역할이 바뀌어도 권한이 TTL 동안 남는다
describe("access 포트 클래스 토큰 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it.each([
    ["EntitlementReaderPort", EntitlementReaderPort],
    ["EntitlementCacheInvalidatorPort", EntitlementCacheInvalidatorPort],
    ["FeatureGranterPort", FeatureGranterPort],
    ["QuotaLedgerPort", QuotaLedgerPort],
  ] as const)("%s는 클래스 토큰으로 주입된다", (_name, token) => {
    // When
    const resolved: unknown = ctx.app.get(token, { strict: false });

    // Then
    expect(resolved).toBeDefined();
  });

  it("다른 Context가 비우는 문은 권한 캐시와 같은 인스턴스다", () => {
    // When
    const invalidator = ctx.app.get(EntitlementCacheInvalidatorPort, { strict: false });
    const cache = ctx.app.get(EntitlementCachePort, { strict: false });

    // Then
    expect(invalidator).toBe(cache);
  });
});
