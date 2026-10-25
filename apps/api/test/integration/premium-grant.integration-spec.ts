import { and } from "@prisma/orm-postgres/orm-client";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { PREMIUM_GRANT_REPOSITORY } from "#api/modules/billing/application/ports/subscriptions/premium-grant.repository.port";
import type { PremiumGrantRepositoryPort } from "#api/modules/billing/application/ports/subscriptions/premium-grant.repository.port";
import { SUBSCRIPTION_REPOSITORY } from "#api/modules/billing/application/ports/subscriptions/subscription.repository.port";
import type { SubscriptionRepositoryPort } from "#api/modules/billing/application/ports/subscriptions/subscription.repository.port";
import { HandleWebhookEvent } from "#api/modules/billing/application/use-cases/subscriptions/handle-webhook-event.use-case";
import { NotifyEndingPremiumGrants } from "#api/modules/billing/application/use-cases/subscriptions/notify-ending-premium-grants.use-case";
import { SweepPremiumGrants } from "#api/modules/billing/application/use-cases/subscriptions/sweep-premium-grants.use-case";
import {
  PREMIUM_ACCESS_READER,
  PREMIUM_GRANTER,
  type PremiumAccessReaderPort,
  type PremiumGranterPort,
} from "#api/modules/billing/billing-subscriptions.public";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
import { STORE_RENEWAL_GRACE_MS } from "#api/shared/domain/store-renewal-grace";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

// KST 13:00. 야간(21:00–08:00)이 아니라 바로 안내할 수 있다
const AT = new Date("2028-02-26T04:00:00.000Z");
const STORE_EXPIRY = new Date("2028-03-10T04:00:00.000Z");
const TRANSACTION_ID = "premium-grant-store-chain";
const DAY_MS = 24 * 60 * 60 * 1_000;

describe("프리미엄 보상 기간과 스토어 구독 정합성 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let granter: PremiumGranterPort;
  let subscriptions: SubscriptionRepositoryPort;
  let entitlement: EntitlementReaderPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    granter = context.module.get<PremiumGranterPort>(PREMIUM_GRANTER);
    subscriptions = context.module.get(SUBSCRIPTION_REPOSITORY);
    entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "premium-grant@example.com",
      userTag: "PGRANT01",
      createdAt: AT,
      updatedAt: AT,
    });
    await client.orm.public.User.create(encodeCreate("User", user));
    userId = user.id;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function givenStoreSubscription(): Promise<void> {
    await subscriptions.create({
      userId,
      revenueCatId: TRANSACTION_ID,
      productId: "premium_monthly",
      status: "ACTIVE",
      startedAt: AT,
      expiresAt: STORE_EXPIRY,
    });
    await subscriptions.updateUserSubscriptionStatus(userId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: STORE_EXPIRY,
    });
  }

  async function grantsOf(target: string) {
    return decodeRecord(
      "PremiumGrant",
      await client.orm.public.PremiumGrant.where((grant) => grant.userId.eq(target))
        .select("sourceKey", "status", "startsAt", "endsAt")
        .orderBy((grant) => grant.sourceKey.asc())
        .all(),
    );
  }

  async function userProjection() {
    return decodeRecord(
      "User",
      await client.orm.public.User.where((row) => row.id.eq(userId))
        .select("subscriptionStatus", "subscriptionExpiresAt")
        .first(),
    );
  }

  it("구독 중 받은 보상은 쌓아 두고 스토어 만료 웹훅이 오면 이어서 시작해 프리미엄을 유지한다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:a", durationDays: 7 });
    vi.setSystemTime(STORE_EXPIRY);
    const body = SubscriptionEventBuilder.expiration()
      .withAppUserId(userId)
      .withOriginalTransactionId(TRANSACTION_ID)
      .withTransactionId(TRANSACTION_ID)
      .withEventId("store-expired")
      .withExpirationAtMs(STORE_EXPIRY.getTime())
      .build();

    // When
    await context.module.get(HandleWebhookEvent).execute({ body });

    // Then
    expect(await grantsOf(userId)).toEqual([
      {
        sourceKey: "invite:a",
        status: "ACTIVE",
        startsAt: STORE_EXPIRY,
        endsAt: new Date("2028-03-17T04:00:00.000Z"),
      },
    ]);
    expect(await userProjection()).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2028-03-17T04:00:00.000Z"),
    });
    expect(await entitlement.hasPremiumAccessInTx(userId)).toBe(true);
  });

  it("같은 보상을 동시에 여러 번 지급해도 한 번만 저장하고 다음 보상은 쌓아 두되 이어 붙인 끝까지 프리미엄이다", async () => {
    // Given
    const requests = Array.from({ length: 5 }, () => ({
      userId,
      source: "INVITE" as const,
      sourceKey: "invite:same",
      durationDays: 7,
    }));

    // When
    const results = await Promise.all(requests.map((request) => granter.grant(request)));
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:next", durationDays: 3 });

    // Then
    expect(results.filter((result) => result.status === "granted")).toHaveLength(1);
    expect(await grantsOf(userId)).toEqual([
      { sourceKey: "invite:next", status: "BANKED", startsAt: null, endsAt: null },
      {
        sourceKey: "invite:same",
        status: "ACTIVE",
        startsAt: AT,
        endsAt: new Date("2028-03-04T04:00:00.000Z"),
      },
    ]);
    expect(await userProjection()).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2028-03-07T04:00:00.000Z"),
    });
  });

  it("끝나기 24시간 전 마지막 기간만 한 번 안내하고 끝나면 sweep이 FREE로 돌린다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:ending", durationDays: 1 });
    const notify = context.module.get(NotifyEndingPremiumGrants);
    const sweep = context.module.get(SweepPremiumGrants);

    // When
    const first = await notify.execute({ now: new Date("2028-02-26T06:00:00.000Z") });
    const repeated = await notify.execute({ now: new Date("2028-02-26T06:10:00.000Z") });
    const swept = await sweep.execute({ now: new Date("2028-02-27T04:00:00.000Z") });

    // Then
    expect([first.notifiedCount, repeated.notifiedCount]).toEqual([1, 0]);
    expect(
      await client.orm.public.Notification.where((row) =>
        and(row.userId.eq(userId), row._type.eq("PREMIUM_GRANT_ENDING")),
      ).aggregate((aggregate) => ({ count: aggregate.count() })),
    ).toEqual({ count: 1 });
    expect(swept).toMatchObject({ userCount: 1, changedGrantCount: 1, failedUserCount: 0 });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
  });

  it("스토어 구독이 웹훅 없이 끝나도 sweep이 그 시각부터 쌓아 둔 보상을 시작하고, 아직 유효한 구독의 보상은 그대로 둔다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:banked", durationDays: 7 });
    const coveredUser = UserFixture.create({
      id: createEntityId(),
      email: "premium-grant-covered@example.com",
      userTag: "PGRANT02",
      createdAt: AT,
      updatedAt: AT,
    });
    await client.orm.public.User.create(encodeCreate("User", coveredUser));
    await subscriptions.create({
      userId: coveredUser.id,
      revenueCatId: "premium-grant-covered-chain",
      productId: "premium_monthly",
      status: "ACTIVE",
      startedAt: AT,
      expiresAt: new Date("2028-04-01T04:00:00.000Z"),
    });
    await subscriptions.updateUserSubscriptionStatus(coveredUser.id, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2028-04-01T04:00:00.000Z"),
    });
    await granter.grant({
      userId: coveredUser.id,
      source: "INVITE",
      sourceKey: "invite:covered",
      durationDays: 7,
    });
    const sweep = context.module.get(SweepPremiumGrants);

    // When
    const swept = await sweep.execute({ now: new Date("2028-03-11T04:00:00.000Z") });

    // Then
    expect(swept).toMatchObject({ userCount: 1, failedUserCount: 0 });
    expect(await grantsOf(userId)).toEqual([
      {
        sourceKey: "invite:banked",
        status: "ACTIVE",
        startsAt: new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS),
        endsAt: new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 7 * DAY_MS),
      },
    ]);
    expect((await grantsOf(coveredUser.id)).map((grant) => grant.status)).toEqual(["BANKED"]);
  });

  async function createUser(tag: string): Promise<string> {
    const user = UserFixture.create({
      id: createEntityId(),
      email: `${tag.toLowerCase()}@example.com`,
      userTag: tag,
      createdAt: AT,
      updatedAt: AT,
    });
    await client.orm.public.User.create(encodeCreate("User", user));
    return user.id;
  }

  it("TRANSFER로 넘겨준 구독 행은 보상 기간이 User를 ACTIVE로 바꿔도 프리미엄을 늘리지 않는다", async () => {
    // Given
    const receiverId = await createUser("PGRANT03");
    await subscriptions.create({
      userId,
      revenueCatId: "transferred-chain",
      productId: "premium_monthly",
      status: "ACTIVE",
      startedAt: AT,
      expiresAt: new Date("2028-03-17T04:00:00.000Z"),
    });
    await subscriptions.updateUserSubscriptionStatus(userId, {
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    const transfer = SubscriptionEventBuilder.transfer()
      .withAppUserId(receiverId)
      .withTransferredFrom([userId])
      .withEventId("transfer-away")
      .build();
    await context.module.get(HandleWebhookEvent).execute({ body: transfer });
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:transfer",
      durationDays: 7,
    });
    const grantEndsAt = new Date("2028-03-04T04:00:00.000Z");

    // When
    vi.setSystemTime(grantEndsAt);
    const swept = await context.module.get(SweepPremiumGrants).execute({ now: grantEndsAt });

    // Then
    expect(swept).toMatchObject({ userCount: 1, failedUserCount: 0 });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(await entitlement.hasPremiumAccessInTx(userId)).toBe(false);
    expect(
      await context.module
        .get<PremiumAccessReaderPort>(PREMIUM_ACCESS_READER)
        .getPremiumAccess(userId),
    ).toMatchObject({ source: null, endsAt: null });
  });

  it("TRANSFER로 구독을 받은 사용자는 보상을 받아도 보상 종료 시각에 프리미엄이 끊기지 않는다", async () => {
    // Given
    const giverId = await createUser("PGRANT06");
    await subscriptions.create({
      userId: giverId,
      revenueCatId: "received-chain",
      productId: "premium_monthly",
      status: "ACTIVE",
      startedAt: AT,
      expiresAt: STORE_EXPIRY,
    });
    const transfer = SubscriptionEventBuilder.transfer()
      .withAppUserId(userId)
      .withTransferredFrom([giverId])
      .withEventId("transfer-in")
      .build();
    await context.module.get(HandleWebhookEvent).execute({ body: transfer });

    // When
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:receiver",
      durationDays: 7,
    });
    const grantWouldEndAt = new Date("2028-03-04T04:00:00.000Z");
    vi.setSystemTime(grantWouldEndAt);
    await context.module.get(SweepPremiumGrants).execute({ now: grantWouldEndAt });

    // Then
    expect(await grantsOf(userId)).toEqual([
      { sourceKey: "invite:receiver", status: "BANKED", startsAt: null, endsAt: null },
    ]);
    expect(await entitlement.hasPremiumAccessInTx(userId)).toBe(true);
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: STORE_EXPIRY,
      bankedDays: 7,
    });
    expect(
      await context.module
        .get<PremiumAccessReaderPort>(PREMIUM_ACCESS_READER)
        .getPremiumAccess(giverId),
    ).toMatchObject({ source: null });
  });

  it("sweep이 돌기 전이라도 보상 기간이 끝나는 시각부터 프리미엄이 아니다", async () => {
    // Given
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:boundary",
      durationDays: 7,
    });
    const endsAt = new Date("2028-03-04T04:00:00.000Z");
    vi.setSystemTime(new Date(endsAt.getTime() - 1));
    const before = await entitlement.hasPremiumAccessInTx(userId);

    // When
    vi.setSystemTime(endsAt);
    const atEnd = await entitlement.hasPremiumAccessInTx(userId);

    // Then
    expect([before, atEnd]).toEqual([true, false]);
    expect((await userProjection())?.subscriptionStatus).toBe("ACTIVE");
  });

  it("자동 갱신 구독은 만료 뒤 유예 시간 동안 쌓아 둔 보상을 시작하지 않고 그 뒤에야 시작한다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:grace", durationDays: 7 });
    const sweep = context.module.get(SweepPremiumGrants);
    const inGrace = new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS - 1);
    const afterGrace = new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS);

    // When
    vi.setSystemTime(inGrace);
    const duringGrace = await sweep.execute({ now: inGrace });
    const premiumDuringGrace = await entitlement.hasPremiumAccessInTx(userId);
    vi.setSystemTime(afterGrace);
    const pastGrace = await sweep.execute({ now: afterGrace });

    // Then
    expect(duringGrace.userCount).toBe(0);
    expect(premiumDuringGrace).toBe(true);
    expect(pastGrace).toMatchObject({ userCount: 1, changedGrantCount: 1 });
    expect(await grantsOf(userId)).toEqual([
      {
        sourceKey: "invite:grace",
        status: "ACTIVE",
        startsAt: afterGrace,
        endsAt: new Date(afterGrace.getTime() + 7 * 24 * 60 * 60 * 1_000),
      },
    ]);
  });

  function purchase(eventId: string, purchasedAt: Date, chainId = TRANSACTION_ID) {
    return SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(userId)
      .withOriginalTransactionId(chainId)
      .withTransactionId(chainId)
      .withEventId(eventId)
      .withPurchasedAtMs(purchasedAt.getTime())
      .withExpirationAtMs(STORE_EXPIRY.getTime())
      .build();
  }

  function storeEvent(builder: SubscriptionEventBuilder, eventId: string) {
    return builder
      .withAppUserId(userId)
      .withOriginalTransactionId(TRANSACTION_ID)
      .withTransactionId(TRANSACTION_ID)
      .withEventId(eventId)
      .withExpirationAtMs(STORE_EXPIRY.getTime())
      .build();
  }

  function premiumAccess() {
    return context.module
      .get<PremiumAccessReaderPort>(PREMIUM_ACCESS_READER)
      .getPremiumAccess(userId);
  }

  it("보상 기간 중 구독을 사면 진행 중인 기간을 구매 시각에 끝내고 남은 일수를 스토어 뒤로 다시 쌓는다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:g1", durationDays: 7 });
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:g2", durationDays: 7 });
    const beforePurchase = await premiumAccess();
    const purchasedAt = new Date("2028-02-28T04:00:00.000Z");
    vi.setSystemTime(purchasedAt);
    const webhook = context.module.get(HandleWebhookEvent);

    // When
    await webhook.execute({ body: purchase("purchase-during-grant", purchasedAt) });
    await webhook.execute({ body: purchase("purchase-during-grant", purchasedAt) });
    await webhook.execute({ body: purchase("purchase-redelivered", purchasedAt) });
    const afterPurchase = await premiumAccess();
    vi.setSystemTime(STORE_EXPIRY);
    await webhook.execute({
      body: storeEvent(SubscriptionEventBuilder.expiration(), "store-expired-after-grants"),
    });

    // Then
    expect(beforePurchase).toEqual({
      source: "GRANT",
      endsAt: new Date("2028-03-11T04:00:00.000Z"),
      periodEndsAt: new Date("2028-03-04T04:00:00.000Z"),
      willRenew: false,
      bankedDays: 7,
    });
    expect(afterPurchase).toEqual({
      source: "STORE",
      endsAt: new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 12 * DAY_MS),
      periodEndsAt: STORE_EXPIRY,
      willRenew: true,
      bankedDays: 12,
    });
    expect(await grantsOf(userId)).toEqual([
      {
        sourceKey: "invite:g1",
        status: "ENDED",
        startsAt: AT,
        endsAt: purchasedAt,
      },
      { sourceKey: "invite:g2", status: "BANKED", startsAt: null, endsAt: null },
      expect.objectContaining({
        sourceKey: expect.stringMatching(/^rebank:/),
        status: "ACTIVE",
        startsAt: STORE_EXPIRY,
        endsAt: new Date(STORE_EXPIRY.getTime() + 5 * DAY_MS),
      }),
    ]);
    expect(await premiumAccess()).toMatchObject({
      source: "GRANT",
      periodEndsAt: new Date(STORE_EXPIRY.getTime() + 5 * DAY_MS),
      endsAt: new Date(STORE_EXPIRY.getTime() + 12 * DAY_MS),
      bankedDays: 7,
    });
  });

  it("구매 웹훅·sweep·보상 지급이 동시에 와도 남은 기간은 한 번만 다시 쌓고 새 보상은 그 뒤에 쌓는다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:running", durationDays: 7 });
    const purchasedAt = new Date("2028-02-29T15:00:00.000Z");
    vi.setSystemTime(purchasedAt);
    const webhook = context.module.get(HandleWebhookEvent);
    const sweep = context.module.get(SweepPremiumGrants);

    // When
    await Promise.all([
      webhook.execute({ body: purchase("concurrent-purchase", purchasedAt) }),
      sweep.execute({ now: purchasedAt }),
      granter.grant({ userId, source: "INVITE", sourceKey: "invite:concurrent", durationDays: 7 }),
    ]);
    // 같은 사용자 웹훅 잠금 경합(SUBSCRIPTION_1605)은 RevenueCat이 다시 보내므로 재전송은 뒤에 온다
    await webhook.execute({ body: purchase("concurrent-purchase-redelivered", purchasedAt) });
    await sweep.execute({ now: purchasedAt });

    // Then
    const grants = await grantsOf(userId);
    expect(grants.filter((grant) => grant.sourceKey.startsWith("rebank:"))).toEqual([
      // 2028-02-26T04:00 시작 7일 중 윤일을 지난 2028-02-29T15:00까지 쓰고 3일 13시간이 남아 4일로 올린다
      { sourceKey: expect.any(String), status: "BANKED", startsAt: null, endsAt: null },
    ]);
    expect(grants.find((grant) => grant.sourceKey === "invite:running")).toMatchObject({
      status: "ENDED",
      endsAt: purchasedAt,
    });
    expect(grants.find((grant) => grant.sourceKey === "invite:concurrent")?.status).toBe("BANKED");
    expect(await premiumAccess()).toMatchObject({ source: "STORE", bankedDays: 11 });
  });

  it("취소한 구독 뒤 쌓아 둔 보상은 만료 시각에 빈틈 없이 시작하고 종료 안내는 마지막 끝 전에만 보낸다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:after-store",
      durationDays: 7,
    });
    const webhook = context.module.get(HandleWebhookEvent);
    await webhook.execute({
      body: storeEvent(SubscriptionEventBuilder.cancellation(), "store-cancelled"),
    });
    const notify = context.module.get(NotifyEndingPremiumGrants);
    const sweep = context.module.get(SweepPremiumGrants);
    const finalEndsAt = new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS);

    // When
    const beforeHandoff = await notify.execute({ now: new Date("2028-03-09T06:00:00.000Z") });
    vi.setSystemTime(new Date(STORE_EXPIRY.getTime() - 1));
    const premiumJustBefore = await entitlement.hasPremiumAccessInTx(userId);
    vi.setSystemTime(STORE_EXPIRY);
    const premiumAtHandoff = await entitlement.hasPremiumAccessInTx(userId);
    const lateSweepAt = new Date(STORE_EXPIRY.getTime() + 10 * 60 * 1_000);
    vi.setSystemTime(lateSweepAt);
    await sweep.execute({ now: lateSweepAt });
    const beforeFinalEnd = await notify.execute({ now: new Date("2028-03-16T06:00:00.000Z") });

    // Then
    expect(beforeHandoff.notifiedCount).toBe(0);
    expect([premiumJustBefore, premiumAtHandoff]).toEqual([true, true]);
    expect(await grantsOf(userId)).toEqual([
      {
        sourceKey: "invite:after-store",
        status: "ACTIVE",
        startsAt: STORE_EXPIRY,
        endsAt: finalEndsAt,
      },
    ]);
    expect(beforeFinalEnd.notifiedCount).toBe(1);
  });

  it("보상이 시작된 뒤 다시 구독하면 진행 중인 보상을 끊어 남은 일수를 새 구독 뒤로 쌓는다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:resub", durationDays: 7 });
    vi.setSystemTime(STORE_EXPIRY);
    const webhook = context.module.get(HandleWebhookEvent);
    await webhook.execute({
      body: storeEvent(SubscriptionEventBuilder.expiration(), "store-expired-before-resub"),
    });
    const resubscribedAt = new Date(STORE_EXPIRY.getTime() + 2 * DAY_MS);
    vi.setSystemTime(resubscribedAt);
    const renewal = SubscriptionEventBuilder.renewal()
      .withAppUserId(userId)
      .withOriginalTransactionId(TRANSACTION_ID)
      .withTransactionId(TRANSACTION_ID)
      .withEventId("resubscribed")
      .withExpirationAtMs(new Date("2028-04-12T04:00:00.000Z").getTime())
      .build();

    // When
    await webhook.execute({ body: renewal });
    await webhook.execute({ body: renewal });

    // Then
    expect(await grantsOf(userId)).toEqual([
      {
        sourceKey: "invite:resub",
        status: "ENDED",
        startsAt: STORE_EXPIRY,
        endsAt: resubscribedAt,
      },
      {
        sourceKey: expect.stringMatching(/^rebank:/),
        status: "BANKED",
        startsAt: null,
        endsAt: null,
      },
    ]);
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: new Date("2028-04-12T04:00:00.000Z"),
      willRenew: true,
      bankedDays: 5,
    });
  });

  it("보상 기간이 끝난 뒤 받은 보상은 쌓지 않고 바로 시작한다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:first", durationDays: 7 });
    const afterFirst = new Date("2028-03-05T04:00:00.000Z");
    vi.setSystemTime(afterFirst);
    await context.module.get(SweepPremiumGrants).execute({ now: afterFirst });

    // When
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:second", durationDays: 7 });

    // Then
    expect(await grantsOf(userId)).toEqual([
      expect.objectContaining({ sourceKey: "invite:first", status: "ENDED" }),
      {
        sourceKey: "invite:second",
        status: "ACTIVE",
        startsAt: afterFirst,
        endsAt: new Date("2028-03-12T04:00:00.000Z"),
      },
    ]);
    expect(await premiumAccess()).toMatchObject({ source: "GRANT", bankedDays: 0 });
  });

  it("스토어가 다시 유효해지면 예전에 미래 시작으로 저장한 기간을 sweep이 다시 쌓아 둔다", async () => {
    // Given
    await givenStoreSubscription();
    await client.orm.public.PremiumGrant.create(
      encodeCreate("PremiumGrant", {
        userId,
        source: "INVITE",
        sourceKey: "invite:legacy-future",
        durationDays: 7,
        status: "ACTIVE",
        startsAt: new Date("2028-03-01T04:00:00.000Z"),
        endsAt: new Date("2028-03-08T04:00:00.000Z"),
      }),
    );

    // When
    const swept = await context.module.get(SweepPremiumGrants).execute({ now: AT });

    // Then
    expect(swept).toMatchObject({ userCount: 1, changedGrantCount: 1 });
    expect(await grantsOf(userId)).toEqual([
      { sourceKey: "invite:legacy-future", status: "BANKED", startsAt: null, endsAt: null },
    ]);
  });

  it("종료 안내 후보는 endsAt·id keyset으로 앞 묶음 다음부터 읽는다", async () => {
    // Given
    const userIds = [userId, await createUser("PGRANT04"), await createUser("PGRANT05")];
    for (const [index, target] of userIds.entries()) {
      await granter.grant({
        userId: target,
        source: "INVITE",
        sourceKey: `invite:notice-${index}`,
        durationDays: 1,
      });
    }
    const repository = context.module.get<PremiumGrantRepositoryPort>(PREMIUM_GRANT_REPOSITORY);
    const params = {
      now: new Date("2028-02-26T06:00:00.000Z"),
      endsBefore: new Date("2028-02-28T00:00:00.000Z"),
    };

    // When
    const first = await repository.lockEndingNotices({ ...params, limit: 1 });
    const rest = await repository.lockEndingNotices({
      ...params,
      after: { endsAt: first[0]?.endsAt ?? params.now, grantId: first[0]?.grantId ?? "" },
      limit: 10,
    });

    // Then
    expect(first).toHaveLength(1);
    expect(rest).toHaveLength(2);
    expect(new Set([...first, ...rest].map((notice) => notice.userId))).toEqual(new Set(userIds));
  });
});
