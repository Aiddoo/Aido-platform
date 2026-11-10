import { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import { SweepPremiumGrantsUseCase } from "#api/modules/billing/premium-grants/application/use-cases/sweep-premium-grants.use-case";
import { STORE_RENEWAL_GRACE_MS } from "#api/modules/billing/shared/store-renewal-grace.domain-service";
import {
  PremiumAccessReaderPort,
  PremiumGranterPort,
} from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { GetCurrentUserUseCase } from "#api/modules/identity/users/application/use-cases/get-current-user.use-case";
import { createEntityId } from "#api/platform/database/entity-id";
import { user as userTable } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { toDateOrNull } from "#test/fixtures/billing/subscription.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

// KST 13:00
const AT = new Date("2028-02-26T04:00:00.000Z");
const STORE_EXPIRY = new Date("2028-03-10T04:00:00.000Z");
const CHAIN = "timeline-store-chain";
const DAY_MS = 24 * 60 * 60 * 1_000;

describe("결제 구독과 보상 기간 결합 타임라인 QA (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let granter: PremiumGranterPort;
  let entitlement: EntitlementReaderPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    granter = context.module.get<PremiumGranterPort>(PremiumGranterPort);
    entitlement = context.module.get(EntitlementReaderPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "timeline@example.com",
      userTag: "TLINE001",
      createdAt: instantFromDate(AT),
      updatedAt: instantFromDate(AT),
    });
    await client.insert(userTable).values(user);
    userId = user.id;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  function webhook(body: unknown) {
    return context.module.get(RevenueCatWebhookReceiver).receive({ body });
  }

  function storeEvent(builder: SubscriptionEventBuilder, eventId: string) {
    return builder
      .withAppUserId(userId)
      .withOriginalTransactionId(CHAIN)
      .withTransactionId(CHAIN)
      .withEventId(eventId)
      .withPurchasedAtMs(AT.getTime())
      .withExpirationAtMs(STORE_EXPIRY.getTime())
      .build();
  }

  function premiumAccess() {
    return context.module
      .get<PremiumAccessReaderPort>(PremiumAccessReaderPort)
      .getPremiumAccess(UserId.reconstitute(userId));
  }

  function isPremium() {
    return entitlement.canInTx(UserId.reconstitute(userId), "AI_REPORT");
  }

  async function userProjection() {
    const row = await client.query.user.findFirst({
      columns: { subscriptionStatus: true, subscriptionExpiresAt: true },
      where: { id: userId },
    });
    return row == null
      ? row
      : { ...row, subscriptionExpiresAt: toDateOrNull(row.subscriptionExpiresAt) };
  }

  async function grantsOf() {
    const rows = await client.query.premiumGrant.findMany({
      columns: {
        sourceKey: true,
        status: true,
        durationDays: true,
        durationMs: true,
        startsAt: true,
        endsAt: true,
      },
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      ...row,
      startsAt: toDateOrNull(row.startsAt),
      endsAt: toDateOrNull(row.endsAt),
    }));
  }

  it("자동 갱신 구독 중 받은 보상은 쌓이고 /me 끝은 유예 3시간 뒤부터 이어 붙인다", async () => {
    // Given
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "s5-purchase"));

    // When
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s5:invite",
      durationDays: 7,
    });

    // Then
    expect(await premiumAccess()).toEqual({
      source: "STORE",
      endsAt: new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 7 * DAY_MS),
      periodEndsAt: STORE_EXPIRY,
      willRenew: true,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect((await grantsOf())[0]).toMatchObject({ status: "BANKED" });
  });

  it("자동 갱신을 끈 구독과 쌓아 둔 보상은 /me와 취소 웹훅 projection 모두 만료 시각부터 이어 붙인다", async () => {
    // Given
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "s6-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s6:invite",
      durationDays: 7,
    });
    vi.setSystemTime(new Date("2028-03-01T04:00:00.000Z"));

    // When
    await webhook(storeEvent(SubscriptionEventBuilder.cancellation(), "s6-cancel"));

    // Then
    expect(await premiumAccess()).toEqual({
      source: "STORE",
      endsAt: new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS),
      periodEndsAt: STORE_EXPIRY,
      willRenew: false,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS),
    });

    // When 만료
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(storeEvent(SubscriptionEventBuilder.expiration(), "s6-expire"));

    // Then 빈틈 없이 이어 시작
    expect(await premiumAccess()).toMatchObject({
      source: "GRANT",
      periodEndsAt: new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS),
      bankedDays: 0,
    });
  });

  it("환불되면 스토어는 즉시 끝나고 쌓아 둔 보상은 환불 시각부터 바로 시작한다", async () => {
    // Given
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "s8-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s8:invite",
      durationDays: 7,
    });
    const refundedAt = new Date("2028-03-01T04:00:00.000Z");
    vi.setSystemTime(refundedAt);

    // When
    await webhook(storeEvent(SubscriptionEventBuilder.refundCancellation(), "s8-refund"));

    // Then
    expect(await premiumAccess()).toEqual({
      source: "GRANT",
      endsAt: new Date(refundedAt.getTime() + 7 * DAY_MS),
      periodEndsAt: new Date(refundedAt.getTime() + 7 * DAY_MS),
      willRenew: false,
      bankedDays: 0,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(await entitlement.canInTx(UserId.reconstitute(userId), "AI_REPORT")).toBe(true);
  });

  function billingIssue(eventId: string, graceEndsAt: Date) {
    return SubscriptionEventBuilder.billingIssue()
      .withAppUserId(userId)
      .withOriginalTransactionId(CHAIN)
      .withTransactionId(CHAIN)
      .withEventId(eventId)
      .withPurchasedAtMs(AT.getTime())
      .withExpirationAtMs(STORE_EXPIRY.getTime())
      .withGracePeriodExpirationAtMs(graceEndsAt.getTime())
      .build();
  }

  function billingErrorCancellation(eventId: string) {
    return storeEvent(
      SubscriptionEventBuilder.cancellation().withCancelReason("BILLING_ERROR"),
      eventId,
    );
  }

  it("스토어 결제 유예 10일째에는 프리미엄을 유지하고 보상을 시작하지 않으며, 결제가 복구되면 쌓아 둔 일수를 그대로 둔다", async () => {
    // Given 결제 실패: RevenueCat은 BILLING_ISSUE와 CANCELLATION(BILLING_ERROR)을 함께 보낸다
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "s7-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "s7:invite",
      durationDays: 7,
    });
    const graceEndsAt = new Date(STORE_EXPIRY.getTime() + 16 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(billingIssue("s7-billing", graceEndsAt));
    await webhook(billingErrorCancellation("s7-billing-cancel"));

    // When 유예 10일째 정리
    const insideGrace = new Date(STORE_EXPIRY.getTime() + 10 * DAY_MS);
    vi.setSystemTime(insideGrace);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(insideGrace) });
    const accessInsideGrace = await premiumAccess();
    const premiumInsideGrace = await isPremium();
    const grantsInsideGrace = await grantsOf();

    // When 12일째 결제 복구
    const recoveredAt = new Date(STORE_EXPIRY.getTime() + 12 * DAY_MS);
    vi.setSystemTime(recoveredAt);
    const nextExpiry = new Date(STORE_EXPIRY.getTime() + 42 * DAY_MS);
    await webhook(
      SubscriptionEventBuilder.renewal()
        .withAppUserId(userId)
        .withOriginalTransactionId(CHAIN)
        .withTransactionId(`${CHAIN}-r1`)
        .withEventId("s7-renewal")
        .withExpirationAtMs(nextExpiry.getTime())
        .build(),
    );

    // Then
    expect(accessInsideGrace).toEqual({
      source: "STORE",
      endsAt: new Date(graceEndsAt.getTime() + 7 * DAY_MS),
      periodEndsAt: graceEndsAt,
      willRenew: false,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(premiumInsideGrace).toBe(true);
    expect(grantsInsideGrace).toEqual([
      expect.objectContaining({ sourceKey: "s7:invite", status: "BANKED", startsAt: null }),
    ]);
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: nextExpiry,
      willRenew: true,
      bankedDays: 7,
    });
    expect(await grantsOf()).toEqual([
      expect.objectContaining({ sourceKey: "s7:invite", status: "BANKED", durationDays: 7 }),
    ]);
  });

  it("결제 유예가 복구 없이 끝나면 쌓아 둔 보상을 유예 끝부터 한 번만 시작하고 늦은 EXPIRATION도 다시 시작하지 않는다", async () => {
    // Given
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "g-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "g:invite",
      durationDays: 7,
    });
    const graceEndsAt = new Date(STORE_EXPIRY.getTime() + 16 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(billingIssue("g-billing", graceEndsAt));
    await webhook(billingErrorCancellation("g-billing-cancel"));

    // When 유예가 끝난 뒤 정리, 이어서 늦은 만료 웹훅
    const afterGrace = new Date(graceEndsAt.getTime() + 10 * 60_000);
    vi.setSystemTime(afterGrace);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(afterGrace) });
    await webhook(
      SubscriptionEventBuilder.expiration()
        .withAppUserId(userId)
        .withOriginalTransactionId(CHAIN)
        .withTransactionId(CHAIN)
        .withEventId("g-expire")
        .withExpirationAtMs(STORE_EXPIRY.getTime())
        .build(),
    );
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(afterGrace) });

    // Then
    expect(await grantsOf()).toEqual([
      {
        sourceKey: "g:invite",
        status: "ACTIVE",
        durationDays: 7,
        durationMs: null,
        startsAt: graceEndsAt,
        endsAt: new Date(graceEndsAt.getTime() + 7 * DAY_MS),
      },
    ]);
    expect(await premiumAccess()).toMatchObject({
      source: "GRANT",
      periodEndsAt: new Date(graceEndsAt.getTime() + 7 * DAY_MS),
      bankedDays: 0,
    });
  });

  it("진행 중인 보상을 두 번 끊어도 남은 기간을 ms 그대로 쌓아 일수 올림이 누적되지 않는다", async () => {
    // Given 보상 진행 중 1일 21시간 뒤 구매, 환불 뒤 다시 1일 9시간 뒤 구매
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "r:invite",
      durationDays: 7,
    });
    vi.setSystemTime(new Date(AT.getTime() + DAY_MS + 21 * 3_600_000));
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "r-purchase"));
    const refundedAt = new Date(AT.getTime() + 3 * DAY_MS);
    vi.setSystemTime(refundedAt);
    await webhook(storeEvent(SubscriptionEventBuilder.refundCancellation(), "r-refund"));

    // When
    vi.setSystemTime(new Date(refundedAt.getTime() + DAY_MS + 9 * 3_600_000));
    await webhook(
      SubscriptionEventBuilder.initialPurchase()
        .withAppUserId(userId)
        .withOriginalTransactionId(`${CHAIN}-second`)
        .withTransactionId(`${CHAIN}-second`)
        .withEventId("r-purchase-2")
        .withPurchasedAtMs(Date.now())
        .withExpirationAtMs(STORE_EXPIRY.getTime())
        .build(),
    );

    // Then 7일 - 1일 21시간 = 5일 3시간, 다시 1일 9시간을 써서 3일 18시간(표시 4일)
    const remainder = (await grantsOf()).find((grant) => grant.status === "BANKED");
    expect(remainder).toMatchObject({ durationDays: 4, durationMs: 3 * DAY_MS + 18 * 3_600_000 });
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      bankedDays: 4,
      endsAt: new Date(
        STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 3 * DAY_MS + 18 * 3_600_000,
      ),
    });
  });

  it("행이 지워진 체인의 RENEWAL은 payload로 체인 행을 만들어 복원한 사용자를 프리미엄으로 이어 간다", async () => {
    // Given 탈퇴(hard delete)로 행이 함께 지워져 TRANSFER로 옮길 행이 없다
    const nextExpiry = new Date(STORE_EXPIRY.getTime() + 30 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);

    // When
    await webhook(
      SubscriptionEventBuilder.renewal()
        .withAppUserId(userId)
        .withOriginalTransactionId(CHAIN)
        .withTransactionId(`${CHAIN}-r2`)
        .withEventId("adopt-renewal")
        .withPurchasedAtMs(STORE_EXPIRY.getTime())
        .withExpirationAtMs(nextExpiry.getTime())
        .withEnvironment("SANDBOX")
        .build(),
    );

    // Then
    expect(
      await client.query.subscription.findFirst({
        columns: {
          userId: true,
          status: true,
          expiresAt: true,
          environment: true,
          productId: true,
        },
        where: { revenueCatId: CHAIN },
      }),
    ).toEqual({
      userId,
      status: "ACTIVE",
      expiresAt: instantFromDate(nextExpiry),
      environment: "SANDBOX",
      productId: "premium_monthly",
    });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: nextExpiry,
    });
    expect(await isPremium()).toBe(true);
  });

  it("만료 시각 없는 UNCANCELLATION은 저장된 만료 시각을 유지해 유료 기간 중에 쌓아 둔 보상을 시작하지 않는다", async () => {
    // Given
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "u-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "u:invite",
      durationDays: 7,
    });
    vi.setSystemTime(new Date("2028-03-01T04:00:00.000Z"));
    await webhook(storeEvent(SubscriptionEventBuilder.cancellation(), "u-cancel"));
    const uncancelledAt = new Date("2028-03-02T04:00:00.000Z");
    vi.setSystemTime(uncancelledAt);

    // When
    await webhook(
      SubscriptionEventBuilder.uncancellation()
        .withAppUserId(userId)
        .withOriginalTransactionId(CHAIN)
        .withTransactionId(CHAIN)
        .withEventId("u-uncancel")
        .withoutExpiration()
        .build(),
    );
    const grantsAfterUncancel = await grantsOf();

    // Then
    expect(grantsAfterUncancel[0]).toMatchObject({ status: "BANKED", startsAt: null });
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: STORE_EXPIRY,
      willRenew: true,
      bankedDays: 7,
    });
  });

  it("결제 유예가 끝난 직후 sweep·만료 웹훅 전이라도 /me 프로필 캐시가 유예 끝에서 만료돼 무료가 된다", async () => {
    // Given 결제 유예 중 /me를 캐시해 둔다
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "m-purchase"));
    const graceEndsAt = new Date(STORE_EXPIRY.getTime() + 16 * DAY_MS);
    vi.setSystemTime(STORE_EXPIRY);
    await webhook(billingIssue("m-billing", graceEndsAt));
    await webhook(billingErrorCancellation("m-billing-cancel"));
    const getMe = context.module.get(GetCurrentUserUseCase);
    const input = { userId, sessionId: "qa-session", timezone: "Asia/Seoul" };
    vi.setSystemTime(new Date(graceEndsAt.getTime() - 60_000));
    const beforeEnd = await getMe.execute(input);

    // When
    vi.setSystemTime(new Date(graceEndsAt.getTime() + 1));
    const afterEnd = await getMe.execute(input);

    // Then
    expect({ source: beforeEnd.premiumSource, isPremium: beforeEnd.isPremium }).toEqual({
      source: "STORE",
      isPremium: true,
    });
    expect({ source: afterEnd.premiumSource, isPremium: afterEnd.isPremium }).toEqual({
      source: null,
      isPremium: false,
    });
  });

  it("보상이 끝난 직후 sweep 전이라도 /me 프로필 캐시가 경계에서 만료돼 source와 isPremium이 함께 무료가 된다", async () => {
    // Given
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "c:invite",
      durationDays: 7,
    });
    const endsAt = new Date(AT.getTime() + 7 * DAY_MS);
    const getMe = context.module.get(GetCurrentUserUseCase);
    const input = { userId, sessionId: "qa-session", timezone: "Asia/Seoul" };
    vi.setSystemTime(new Date(endsAt.getTime() - 60_000));
    await getMe.execute(input);

    // When
    vi.setSystemTime(new Date(endsAt.getTime() + 60_000));
    const afterEnd = await getMe.execute(input);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(new Date()) });
    const fresh = await getMe.execute(input);

    // Then
    expect({ source: afterEnd.premiumSource, isPremium: afterEnd.isPremium }).toEqual({
      source: null,
      isPremium: false,
    });
    expect({ source: fresh.premiumSource, isPremium: fresh.isPremium }).toEqual({
      source: null,
      isPremium: false,
    });
  });

  it("월간에서 연간으로 바꾸면 상품 변경 안내는 기간을 두고, 연간 갱신이 만료만 늘리며 쌓아 둔 보상은 유지된다", async () => {
    // Given
    await webhook(storeEvent(SubscriptionEventBuilder.initialPurchase(), "p-purchase"));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "p:invite",
      durationDays: 7,
    });
    const annualExpiry = new Date("2029-03-10T04:00:00.000Z");

    // When
    await webhook(
      storeEvent(
        SubscriptionEventBuilder.productChange().withNewProductId("premium_annual"),
        "p-change",
      ),
    );
    const afterChange = await premiumAccess();
    await webhook(
      SubscriptionEventBuilder.renewal()
        .withAppUserId(userId)
        .withOriginalTransactionId(CHAIN)
        .withTransactionId(`${CHAIN}-annual`)
        .withProductId("premium_annual")
        .withEventId("p-renew-annual")
        .withExpirationAtMs(annualExpiry.getTime())
        .build(),
    );

    // Then
    expect(afterChange).toMatchObject({ periodEndsAt: STORE_EXPIRY, bankedDays: 7 });
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: annualExpiry,
      bankedDays: 7,
    });
    expect((await grantsOf())[0]).toMatchObject({ status: "BANKED" });
  });
});
