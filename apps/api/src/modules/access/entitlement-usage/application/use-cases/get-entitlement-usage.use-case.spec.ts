import { ErrorCode } from "@aido/api/errors";
import { PLAN_CATALOG, PLAN_FEATURE_KEYS } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  InMemoryAccessStateReader,
  type InMemoryAccessUser,
} from "#test/doubles/access/in-memory-access-state.reader";
import { InMemoryQuotaUsageRepository } from "#test/doubles/access/in-memory-quota-usage.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import {
  ACCESS_FIXTURE_NOW,
  ACCESS_FIXTURE_USER_ID,
  createAccessUserFixture,
  type AccessUserInput,
} from "#test/fixtures/access/access-user.fixture";

import { NO_FEATURE_GRANTS, type FeatureGrants } from "../../../shared/domain/access.constants.js";
import {
  OwnedFeatureUsageReaderPort,
  type OwnedFeatureUsage,
} from "../ports/owned-feature-usage.reader.port.js";
import { GetEntitlementUsageUseCase } from "./get-entitlement-usage.use-case.js";

// 서울 4월 13일 00:00
const DAILY_RESETS_AT = Temporal.Instant.from("2026-04-12T15:00:00Z");

class StubOwnedFeatureUsageReader extends OwnedFeatureUsageReaderPort {
  readonly requests: { readonly userId: UserId; readonly timeZone: string }[] = [];
  readonly #usage: OwnedFeatureUsage;

  constructor(usage: OwnedFeatureUsage) {
    super();
    this.#usage = usage;
  }

  async read(params: { readonly userId: UserId; readonly timeZone: string }) {
    this.requests.push(params);
    return this.#usage;
  }
}

function setup(input: {
  readonly user?: AccessUserInput;
  readonly grants?: FeatureGrants;
  readonly cheerUsed?: number;
  readonly friends?: number;
  readonly categories?: number;
}) {
  const users = new Map<string, InMemoryAccessUser>([
    [ACCESS_FIXTURE_USER_ID, createAccessUserFixture(input.user)],
  ]);
  const accessStateReader = new InMemoryAccessStateReader(users);
  accessStateReader.featureGrants.seed(ACCESS_FIXTURE_USER_ID, input.grants ?? NO_FEATURE_GRANTS);
  const quotaUsageRepository = new InMemoryQuotaUsageRepository(users);
  const ownedFeatureUsageReader = new StubOwnedFeatureUsageReader({
    daily: {
      CHEER: { used: input.cheerUsed ?? 0, resetsAt: DAILY_RESETS_AT },
      NUDGE: { used: 0, resetsAt: DAILY_RESETS_AT },
    },
    resourceCounts: { FRIEND: input.friends ?? 0, TODO_CATEGORY: input.categories ?? 0 },
  });
  const useCase = new GetEntitlementUsageUseCase({
    accessStateReader,
    quotaUsageRepository,
    ownedFeatureUsageReader,
    clock: new FixedClock(ACCESS_FIXTURE_NOW),
  });
  return {
    users,
    quotaUsageRepository,
    ownedFeatureUsageReader,
    execute: () => useCase.execute({ userId: ACCESS_FIXTURE_USER_ID, timeZone: "Asia/Seoul" }),
  };
}

describe("GetEntitlementUsageUseCase — 권한·한도·사용량", () => {
  it("모든 기능의 한도와 계량기·일간 사용량을 서버가 계산하고 일간 사용량은 요청 시간대로 읽는다", async () => {
    // Given
    const fixture = setup({ user: { aiUsageCount: 3 }, cheerUsed: 2 });
    fixture.quotaUsageRepository.setUsage({
      userId: ACCESS_FIXTURE_USER_ID,
      meter: "VOICE_NOTE",
      periodKey: "2026-M04",
      used: 1,
    });

    // When
    const usage = await fixture.execute();

    // Then
    expect(usage).toMatchObject({ isPremium: false, tier: "FREE", plan: "free" });
    expect(Object.keys(usage.features)).toEqual([...PLAN_FEATURE_KEYS]);
    expect(usage.features.AI_PARSE).toMatchObject({ used: 3, remaining: 7, period: "month" });
    expect(usage.features.AI_PARSE.resetsAt?.toString()).toBe("2026-04-30T15:00:00Z");
    expect(usage.features.VOICE_NOTE).toMatchObject({
      used: 1,
      remaining: PLAN_CATALOG.VOICE_NOTE.free - 1,
    });
    expect(usage.features.CHEER).toMatchObject({
      limit: PLAN_CATALOG.CHEER.free,
      used: 2,
      remaining: PLAN_CATALOG.CHEER.free - 2,
      period: "day",
    });
    expect(usage.features.CHEER.resetsAt?.equals(DAILY_RESETS_AT)).toBe(true);
    expect(usage.features.AI_REPORT).toMatchObject({ allowed: false, used: null });
    expect(fixture.ownedFeatureUsageReader.requests.map((request) => request.timeZone)).toEqual([
      "Asia/Seoul",
    ]);
  });

  it("무료 사용자가 카테고리·친구 한도에 닿으면 남은 자리가 0이고 초기화 시각은 없다", async () => {
    // Given
    const fixture = setup({
      friends: PLAN_CATALOG.FRIEND.free,
      categories: PLAN_CATALOG.TODO_CATEGORY.free,
    });

    // When
    const usage = await fixture.execute();

    // Then
    expect(usage.features.TODO_CATEGORY).toEqual({
      feature: "TODO_CATEGORY",
      allowed: true,
      limit: PLAN_CATALOG.TODO_CATEGORY.free,
      used: PLAN_CATALOG.TODO_CATEGORY.free,
      remaining: 0,
      period: null,
      resetsAt: null,
      isFairUse: false,
      perUse: null,
    });
    expect(usage.features.FRIEND).toMatchObject({
      limit: PLAN_CATALOG.FRIEND.free,
      used: PLAN_CATALOG.FRIEND.free,
      remaining: 0,
      resetsAt: null,
    });
  });

  it("한도보다 적으면 남은 자리를 주고, 한도를 넘게 가진 개수도 남은 자리는 0 아래로 내려가지 않는다", async () => {
    // Given
    const fixture = setup({ friends: PLAN_CATALOG.FRIEND.free + 2, categories: 1 });

    // When
    const usage = await fixture.execute();

    // Then
    expect(usage.features.TODO_CATEGORY).toMatchObject({
      used: 1,
      remaining: PLAN_CATALOG.TODO_CATEGORY.free - 1,
    });
    expect(usage.features.FRIEND).toMatchObject({
      used: PLAN_CATALOG.FRIEND.free + 2,
      remaining: 0,
    });
  });

  it("친구 한도는 초대 보상 자리를 더한 한도로 남은 자리를 센다", async () => {
    // Given
    const fixture = setup({ friends: PLAN_CATALOG.FRIEND.free, grants: { FRIEND: 2 } });

    // When
    const usage = await fixture.execute();

    // Then
    expect(usage.features.FRIEND).toMatchObject({
      limit: PLAN_CATALOG.FRIEND.free + 2,
      used: PLAN_CATALOG.FRIEND.free,
      remaining: 2,
    });
  });

  it("프리미엄은 카테고리를 프리미엄 한도로 세고, 무제한인 친구는 개수를 싣지 않는다", async () => {
    // Given
    const fixture = setup({
      user: { subscriptionStatus: "ACTIVE" },
      friends: 12,
      categories: PLAN_CATALOG.TODO_CATEGORY.premium,
    });

    // When
    const usage = await fixture.execute();

    // Then
    expect(usage.features.TODO_CATEGORY).toMatchObject({
      limit: PLAN_CATALOG.TODO_CATEGORY.premium,
      used: PLAN_CATALOG.TODO_CATEGORY.premium,
      remaining: 0,
    });
    expect(usage.features.FRIEND).toMatchObject({
      allowed: true,
      limit: null,
      used: null,
      remaining: null,
      resetsAt: null,
    });
  });

  it("ADMIN은 프리미엄과 같은 한도·사용량을 받고 카테고리는 프리미엄 한도로 센다", async () => {
    // Given
    const usage = { friends: 40, categories: PLAN_CATALOG.TODO_CATEGORY.premium + 1 };
    const admin = setup({ user: { role: "ADMIN" }, ...usage });
    const premium = setup({ user: { subscriptionStatus: "ACTIVE" }, ...usage });

    // When
    const adminUsage = await admin.execute();
    const premiumUsage = await premium.execute();

    // Then
    expect(adminUsage).toMatchObject({ tier: "ADMIN", plan: "premium", isPremium: false });
    expect(adminUsage.features).toEqual(premiumUsage.features);
    expect(adminUsage.features.TODO_CATEGORY).toMatchObject({
      limit: PLAN_CATALOG.TODO_CATEGORY.premium,
      used: PLAN_CATALOG.TODO_CATEGORY.premium + 1,
      remaining: 0,
    });
    expect(adminUsage.features.AI_PARSE).toMatchObject({
      limit: PLAN_CATALOG.AI_PARSE.fairUse.premium,
      isFairUse: true,
    });
    expect(adminUsage.features.FRIEND).toMatchObject({ limit: null, used: null });
  });

  it("사용자가 없으면 USER_0601이다", async () => {
    // Given
    const fixture = setup({});
    fixture.users.clear();

    // When
    const execution = fixture.execute();

    // Then
    await expect(execution).rejects.toMatchObject({ errorCode: ErrorCode.USER_0601 });
  });
});
