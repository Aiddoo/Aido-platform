import type { RevenueCatWebhookPayload } from "@aido/api";
import { and, eq } from "drizzle-orm";

import { PremiumAccessReaderPort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { SubscriptionEventNotifierPort } from "#api/modules/billing/subscriptions/application/ports/subscription-event-notifier.port";
import { NotifyUpcomingRenewalsUseCase } from "#api/modules/billing/subscriptions/application/use-cases/notify-upcoming-renewals.use-case";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  notification,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder, UserPreferenceBuilder } from "#test/builders/index";
import { toDateOrNull } from "#test/fixtures/billing/subscription.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// 런던 12:00(낮)이라 야간으로 미루지 않는다
const at = new Date("2027-01-04T12:00:00.000Z");
const periodEndsAt = new Date("2027-01-10T12:00:00.000Z");
const periodStartedAt = new Date("2026-01-10T12:00:00.000Z");
const nextPeriodEndsAt = new Date("2028-01-10T12:00:00.000Z");
const nextNoticeAt = new Date("2028-01-04T12:00:00.000Z");

const YEARLY = "com.aido.pro.yearly";
const MONTHLY = "com.aido.pro.monthly";

const subscriptionEventNotifier: SubscriptionEventNotifierPort = {
  notifySubscriptionEvent: () => {},
  recordBillingIssue: async () => {},
  reportWebhookFailure: () => {},
};

describe("연간 구독 갱신 7일 전 안내와 상품 변경 예약 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let webhook: RevenueCatWebhookReceiver;
  let notifyUpcomingRenewals: NotifyUpcomingRenewalsUseCase;
  let premiumAccess: PremiumAccessReaderPort;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(SubscriptionEventNotifierPort).useValue(subscriptionEventNotifier),
    });
    webhook = context.module.get(RevenueCatWebhookReceiver);
    notifyUpcomingRenewals = context.module.get(NotifyUpcomingRenewalsUseCase);
    premiumAccess = context.module.get(PremiumAccessReaderPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function givenUser(tag: string): Promise<string> {
    const user = UserFixture.create({
      id: createEntityId(),
      email: `renewal-${tag.toLowerCase()}@example.com`,
      userTag: tag,
      subscriptionStatus: "FREE",
      createdAt: instantFromDate(periodStartedAt),
      updatedAt: instantFromDate(periodStartedAt),
    });
    await client.insert(userTable).values(user);
    await client
      .insert(userPreference)
      .values(UserPreferenceBuilder.create(user.id).withTimezone("Europe/London").build());
    return user.id;
  }

  function storeEvent(
    userId: string,
    builder: SubscriptionEventBuilder,
    input: { chain: string; eventId: string; productId: string; expiresAt: Date },
  ): RevenueCatWebhookPayload {
    return builder
      .withAppUserId(userId)
      .withOriginalTransactionId(input.chain)
      .withTransactionId(input.chain)
      .withEventId(input.eventId)
      .withProductId(input.productId)
      .withExpirationAtMs(input.expiresAt.getTime())
      .build();
  }

  async function givenPurchase(
    userId: string,
    productId: string,
    { chain = `chain-${userId}`, startedAt = periodStartedAt, expiresAt = periodEndsAt } = {},
  ): Promise<void> {
    await webhook.receive({
      body: storeEvent(
        userId,
        SubscriptionEventBuilder.initialPurchase().withPurchasedAtMs(startedAt.getTime()),
        { chain, eventId: `purchase-${chain}`, productId, expiresAt },
      ),
    });
  }

  async function renewalNotices(userId: string) {
    return client
      .select({ title: notification.title })
      .from(notification)
      .where(
        and(eq(notification.userId, userId), eq(notification.type, "PREMIUM_RENEWAL_UPCOMING")),
      );
  }

  async function storedChain(userId: string) {
    const row = await client.query.subscription.findFirst({
      columns: { productId: true, nextProductId: true, expiresAt: true },
      where: { revenueCatId: `chain-${userId}` },
    });
    return row == null ? row : { ...row, expiresAt: toDateOrNull(row.expiresAt) };
  }

  it("연간 구독은 겹친 실행에도 기간마다 한 번만 알리고, 갱신으로 기간이 바뀌면 다음 기간에 다시 알린다", async () => {
    // Given
    const userId = await givenUser("RENEW001");
    await givenPurchase(userId, YEARLY);

    // When
    const concurrent = await Promise.all([
      notifyUpcomingRenewals.execute({ now: instantFromDate(at) }),
      notifyUpcomingRenewals.execute({ now: instantFromDate(at) }),
    ]);
    const repeated = await notifyUpcomingRenewals.execute({ now: instantFromDate(at) });
    await webhook.receive({
      body: storeEvent(userId, SubscriptionEventBuilder.renewal(), {
        chain: `chain-${userId}`,
        eventId: "renew-2027",
        productId: YEARLY,
        expiresAt: nextPeriodEndsAt,
      }),
    });
    const sameDayAfterRenewal = await notifyUpcomingRenewals.execute({ now: instantFromDate(at) });
    vi.setSystemTime(nextNoticeAt);
    const nextPeriod = await notifyUpcomingRenewals.execute({ now: instantFromDate(nextNoticeAt) });

    // Then
    expect(concurrent.map((result) => result.notifiedCount).sort()).toEqual([0, 1]);
    expect([repeated.notifiedCount, sameDayAfterRenewal.notifiedCount]).toEqual([0, 0]);
    expect(nextPeriod.notifiedCount).toBe(1);
    expect(await renewalNotices(userId)).toEqual([
      { title: "6일 뒤 연간 구독이 갱신돼요" },
      { title: "6일 뒤 연간 구독이 갱신돼요" },
    ]);
  });

  it.each([
    { productId: "com.aido.pro.yearly:yearly-base", expected: 1 },
    { productId: MONTHLY, expected: 0 },
    { productId: "com.aido.pro.monthly:monthly-base", expected: 0 },
    { productId: "premium_annual", expected: 0 },
  ])("상품 $productId은 갱신 안내 대상 $expected건이다", async ({ productId, expected }) => {
    // Given
    const userId = await givenUser("RENEW002");
    await givenPurchase(userId, productId);

    // When
    const result = await notifyUpcomingRenewals.execute({ now: instantFromDate(at) });

    // Then
    expect(result.notifiedCount).toBe(expected);
    expect(await renewalNotices(userId)).toHaveLength(expected);
  });

  it("App Store에서 연간→월간으로 바꾸면 지금 기간은 연간 그대로 두고 갱신 안내를 보내지 않으며, 다음 갱신부터 월간이다", async () => {
    // Given
    const userId = await givenUser("RENEW003");
    await givenPurchase(userId, YEARLY);
    const chain = `chain-${userId}`;

    // When
    await webhook.receive({
      body: storeEvent(userId, SubscriptionEventBuilder.productChange().withNewProductId(MONTHLY), {
        chain,
        eventId: "change-to-monthly",
        productId: YEARLY,
        expiresAt: periodEndsAt,
      }),
    });
    const beforeRenewal = await premiumAccess.getPremiumAccess(UserId.reconstitute(userId));
    const notified = await notifyUpcomingRenewals.execute({ now: instantFromDate(at) });
    const monthlyEndsAt = new Date(periodEndsAt.getTime() + 31 * DAY_MS);
    vi.setSystemTime(periodEndsAt);
    await webhook.receive({
      body: storeEvent(userId, SubscriptionEventBuilder.renewal(), {
        chain,
        eventId: "renew-monthly",
        productId: MONTHLY,
        expiresAt: monthlyEndsAt,
      }),
    });

    // Then
    expect(beforeRenewal).toMatchObject({ planType: "ANNUAL", periodEndsAt });
    expect(notified.notifiedCount).toBe(0);
    expect(await storedChain(userId)).toEqual({
      productId: MONTHLY,
      nextProductId: null,
      expiresAt: monthlyEndsAt,
    });
    expect(await premiumAccess.getPremiumAccess(UserId.reconstitute(userId))).toMatchObject({
      planType: "MONTHLY",
    });
  });

  it("App Store에서 월간→연간으로 바꾸면 다음 결제가 연간이라 갱신 안내를 보내고, 갱신 뒤 연간이다", async () => {
    // Given
    const userId = await givenUser("RENEW004");
    await givenPurchase(userId, MONTHLY, { startedAt: new Date(at.getTime() - 25 * DAY_MS) });
    const chain = `chain-${userId}`;

    // When
    await webhook.receive({
      body: storeEvent(userId, SubscriptionEventBuilder.productChange().withNewProductId(YEARLY), {
        chain,
        eventId: "change-to-yearly",
        productId: MONTHLY,
        expiresAt: periodEndsAt,
      }),
    });
    const notified = await notifyUpcomingRenewals.execute({ now: instantFromDate(at) });
    const beforeRenewal = await premiumAccess.getPremiumAccess(UserId.reconstitute(userId));
    vi.setSystemTime(periodEndsAt);
    await webhook.receive({
      body: storeEvent(userId, SubscriptionEventBuilder.renewal(), {
        chain,
        eventId: "renew-yearly",
        productId: YEARLY,
        expiresAt: nextPeriodEndsAt,
      }),
    });

    // Then
    expect(notified.notifiedCount).toBe(1);
    expect(beforeRenewal.planType).toBe("MONTHLY");
    expect(await premiumAccess.getPremiumAccess(UserId.reconstitute(userId))).toMatchObject({
      planType: "ANNUAL",
    });
  });

  it("Play에서 연간→월간으로 바꿔 새 체인이 생기면 원래 만료까지 ACTIVE로 남은 옛 연간 체인에는 갱신 안내를 보내지 않는다", async () => {
    // Given
    const userId = await givenUser("RENEW005");
    await givenPurchase(userId, "com.aido.pro.yearly:yearly-base", { chain: "play-yearly" });
    await givenPurchase(userId, "com.aido.pro.monthly:monthly-base", {
      chain: "play-monthly",
      startedAt: at,
      expiresAt: new Date(at.getTime() + 31 * DAY_MS),
    });

    // When
    const result = await notifyUpcomingRenewals.execute({ now: instantFromDate(at) });

    // Then
    expect(result.notifiedCount).toBe(0);
    expect(await renewalNotices(userId)).toEqual([]);
  });

  it("Play에서 연간 중간에 월간으로 바꾼 직후 /me는 새 체인의 월간·만료·갱신을 보이고 결제한 연간 끝까지 프리미엄이다", async () => {
    // Given
    const userId = await givenUser("RENEW007");
    const annualEndsAt = new Date("2027-06-01T00:00:00.000Z");
    const monthlyEndsAt = new Date(at.getTime() + 31 * DAY_MS);
    await givenPurchase(userId, "com.aido.pro.yearly:yearly-base", {
      chain: "play-yearly-mid",
      startedAt: new Date("2026-06-01T00:00:00.000Z"),
      expiresAt: annualEndsAt,
    });

    // When
    await givenPurchase(userId, "com.aido.pro.monthly:monthly-base", {
      chain: "play-monthly-mid",
      startedAt: at,
      expiresAt: monthlyEndsAt,
    });

    // Then
    expect(await premiumAccess.getPremiumAccess(UserId.reconstitute(userId))).toMatchObject({
      source: "STORE",
      planType: "MONTHLY",
      periodEndsAt: monthlyEndsAt,
      willRenew: true,
      endsAt: annualEndsAt,
    });
  });

  it("갱신 뒤 늦게 온 지난 기간의 상품 변경은 갱신된 기간·상품을 앞당기거나 바꾸지 않는다", async () => {
    // Given
    const userId = await givenUser("RENEW006");
    await givenPurchase(userId, YEARLY);
    const chain = `chain-${userId}`;
    await webhook.receive({
      body: storeEvent(userId, SubscriptionEventBuilder.renewal(), {
        chain,
        eventId: "renew-before-late-change",
        productId: YEARLY,
        expiresAt: nextPeriodEndsAt,
      }),
    });

    // When
    await webhook.receive({
      body: storeEvent(userId, SubscriptionEventBuilder.productChange().withNewProductId(MONTHLY), {
        chain,
        eventId: "late-change",
        productId: YEARLY,
        expiresAt: periodEndsAt,
      }),
    });

    // Then
    expect(await storedChain(userId)).toEqual({
      productId: YEARLY,
      nextProductId: null,
      expiresAt: nextPeriodEndsAt,
    });
    expect(await premiumAccess.getPremiumAccess(UserId.reconstitute(userId))).toMatchObject({
      periodEndsAt: nextPeriodEndsAt,
      planType: "ANNUAL",
    });
  });
});
