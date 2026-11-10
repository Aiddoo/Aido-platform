import {
  ENTITLEMENT_READER,
  ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
  EntitlementReaderPort,
  EntitlementSubscriptionInvalidatorPort,
  RESOURCE_BONUS_GRANTER,
  ResourceBonusGranterPort,
} from "#api/modules/access/entitlements/access-entitlements.public";
import { QUOTA_LEDGER, QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

// 옮기지 않은 소비 Context(ai·billing·identity·planning·social·notification·voice)가 쓰는 옛 Symbol 토큰이
// 새 클래스 토큰과 같은 인스턴스여야 권한 캐시·원장이 두 갈래로 나뉘지 않는다
describe("access 포트 옛 토큰 별칭 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it.each([
    ["EntitlementReaderPort", ENTITLEMENT_READER, EntitlementReaderPort],
    [
      "EntitlementSubscriptionInvalidatorPort",
      ENTITLEMENT_SUBSCRIPTION_INVALIDATOR,
      EntitlementSubscriptionInvalidatorPort,
    ],
    ["ResourceBonusGranterPort", RESOURCE_BONUS_GRANTER, ResourceBonusGranterPort],
    ["QuotaLedgerPort", QUOTA_LEDGER, QuotaLedgerPort],
  ] as const)("%s 옛 Symbol 토큰은 클래스 토큰과 같은 인스턴스다", (_name, oldToken, newToken) => {
    // When
    const viaOldToken: unknown = ctx.app.get(oldToken, { strict: false });
    const viaNewToken: unknown = ctx.app.get(newToken, { strict: false });

    // Then
    expect(viaNewToken).toBeDefined();
    expect(viaOldToken).toBe(viaNewToken);
  });
});
