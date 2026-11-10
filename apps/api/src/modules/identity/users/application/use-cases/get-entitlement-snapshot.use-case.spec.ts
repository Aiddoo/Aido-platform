import { PLAN_CATALOG } from "@aido/api/vocabulary";

import type { ResourceBonuses } from "#api/modules/access/entitlements/domain/entitlement.domain-service";
import { createQuotaLedgerFixture } from "#test/fixtures/quota-ledger.fixture";
import type { InMemoryQuotaUser } from "#test/mocks/ports/quota-ledger.stub";

import { GetEntitlementSnapshotUseCase } from "./get-entitlement-snapshot.use-case.js";

const DAILY_RESETS_AT = new Date("2026-04-12T15:00:00Z");

describe("GetEntitlementSnapshot — 권한 스냅샷", () => {
  function given(input: {
    readonly friends: number;
    readonly categories: number;
    readonly user?: Partial<InMemoryQuotaUser>;
    readonly resourceBonuses?: ResourceBonuses;
  }) {
    const ledgerFixture = createQuotaLedgerFixture(input.user, input.resourceBonuses);
    const friendCounts = new Map([[ledgerFixture.userId, input.friends]]);
    const categoryCounts = new Map([[ledgerFixture.userId, input.categories]]);
    const useCase = new GetEntitlementSnapshotUseCase({
      quotaLedger: ledgerFixture.ledger,
      cheerUsageReader: { readDailyUsage: async () => ({ used: 1, resetsAt: DAILY_RESETS_AT }) },
      nudgeUsageReader: { readDailyUsage: async () => ({ used: 0, resetsAt: DAILY_RESETS_AT }) },
      friendCountReader: { countCurrentFriends: async (userId) => friendCounts.get(userId) ?? 0 },
      categoryCountReader: { countCategories: async (userId) => categoryCounts.get(userId) ?? 0 },
    });
    return {
      userId: ledgerFixture.userId,
      execute: () => useCase.execute({ userId: ledgerFixture.userId, timezone: "Asia/Seoul" }),
    };
  }

  it("무료 사용자가 카테고리를 한도만큼 가지면 남은 자리 0을 받아 앱이 입력 전에 막을 수 있다", async () => {
    // Given
    const fixture = given({ friends: 2, categories: PLAN_CATALOG.TODO_CATEGORY.free });

    // When
    const snapshot = await fixture.execute();

    // Then
    expect(snapshot.features.TODO_CATEGORY).toMatchObject({
      limit: PLAN_CATALOG.TODO_CATEGORY.free,
      used: PLAN_CATALOG.TODO_CATEGORY.free,
      remaining: 0,
      resetsAt: null,
    });
    expect(snapshot.features.FRIEND).toMatchObject({
      limit: PLAN_CATALOG.FRIEND.free,
      used: 2,
      remaining: PLAN_CATALOG.FRIEND.free - 2,
      resetsAt: null,
    });
    expect(snapshot.features.CHEER).toMatchObject({ used: 1 });
  });

  it("초대 보상 자리가 있으면 무료 친구 한도를 채워도 보상만큼 남는다", async () => {
    // Given
    const fixture = given({
      friends: PLAN_CATALOG.FRIEND.free,
      categories: 0,
      resourceBonuses: { FRIEND: 1 },
    });

    // When
    const snapshot = await fixture.execute();

    // Then
    expect(snapshot.features.FRIEND).toMatchObject({
      limit: PLAN_CATALOG.FRIEND.free + 1,
      used: PLAN_CATALOG.FRIEND.free,
      remaining: 1,
    });
  });

  it("프리미엄의 무제한 친구는 개수를 싣지 않고 카테고리는 프리미엄 한도로 센다", async () => {
    // Given
    const fixture = given({ friends: 9, categories: 4, user: { subscriptionStatus: "ACTIVE" } });

    // When
    const snapshot = await fixture.execute();

    // Then
    expect(snapshot.features.FRIEND).toMatchObject({ limit: null, used: null, remaining: null });
    expect(snapshot.features.TODO_CATEGORY).toMatchObject({
      limit: PLAN_CATALOG.TODO_CATEGORY.premium,
      used: 4,
      remaining: PLAN_CATALOG.TODO_CATEGORY.premium - 4,
    });
  });
});
