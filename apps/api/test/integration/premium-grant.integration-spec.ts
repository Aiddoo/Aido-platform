import { and, eq } from "drizzle-orm";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { PremiumGrantEndingNoticeRepositoryPort } from "#api/modules/billing/premium-grants/application/ports/premium-grant-ending-notice.repository.port";
import { UserSubscriptionProjectionRepositoryPort } from "#api/modules/billing/premium-grants/application/ports/user-subscription-projection.repository.port";
import { NotifyEndingPremiumGrantsUseCase } from "#api/modules/billing/premium-grants/application/use-cases/notify-ending-premium-grants.use-case";
import { RevokePremiumGrantUseCase } from "#api/modules/billing/premium-grants/application/use-cases/revoke-premium-grant.use-case";
import { SweepPremiumGrantsUseCase } from "#api/modules/billing/premium-grants/application/use-cases/sweep-premium-grants.use-case";
import { SubscriptionRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/subscription.repository.port";
import { STORE_RENEWAL_GRACE_MS } from "#api/modules/billing/subscriptions/billing-subscriptions-entitlement.public";
import {
  PremiumAccessReaderPort,
  PremiumGranterPort,
} from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { createEntityId } from "#api/platform/database/entity-id";
import { notification, premiumGrant, user as userTable } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder } from "#test/builders/index";
import {
  saveSubscriptionFixture,
  setUserSubscriptionProjection,
  toDateOrNull,
} from "#test/fixtures/billing/subscription.fixture";
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
  let projection: UserSubscriptionProjectionRepositoryPort;
  let entitlement: EntitlementReaderPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    granter = context.module.get<PremiumGranterPort>(PremiumGranterPort);
    subscriptions = context.module.get(SubscriptionRepositoryPort);
    projection = context.module.get(UserSubscriptionProjectionRepositoryPort);
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

  async function givenStoreSubscription(): Promise<void> {
    await saveSubscriptionFixture(subscriptions, {
      userId: userId,
      storeSubscriptionId: TRANSACTION_ID,
      startedAt: instantFromDate(AT),
      expiresAt: instantFromDate(STORE_EXPIRY),
    });
    await setUserSubscriptionProjection(projection, userId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: STORE_EXPIRY,
    });
  }

  async function grantsOf(target: string) {
    const rows = await client.query.premiumGrant.findMany({
      columns: { sourceKey: true, status: true, startsAt: true, endsAt: true },
      where: { userId: target },
      orderBy: { sourceKey: "asc" },
    });
    return rows.map((row) => ({
      ...row,
      startsAt: toDateOrNull(row.startsAt),
      endsAt: toDateOrNull(row.endsAt),
    }));
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
    await context.module.get(RevenueCatWebhookReceiver).receive({ body });

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
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(true);
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
    const notify = context.module.get(NotifyEndingPremiumGrantsUseCase);
    const sweep = context.module.get(SweepPremiumGrantsUseCase);

    // When
    const first = await notify.execute({
      now: instantFromDate(new Date("2028-02-26T06:00:00.000Z")),
    });
    const repeated = await notify.execute({
      now: instantFromDate(new Date("2028-02-26T06:10:00.000Z")),
    });
    const swept = await sweep.execute({
      now: instantFromDate(new Date("2028-02-27T04:00:00.000Z")),
    });

    // Then
    expect([first.notifiedCount, repeated.notifiedCount]).toEqual([1, 0]);
    expect(
      await client.$count(
        notification,
        and(eq(notification.userId, userId), eq(notification.type, "PREMIUM_GRANT_ENDING")),
      ),
    ).toBe(1);
    expect(swept).toMatchObject({ userCount: 1, changedGrantCount: 1, failedUserCount: 0 });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    vi.setSystemTime(new Date("2028-02-27T04:00:00.000Z"));
    expect(await premiumAccess()).toMatchObject({
      source: null,
      recentGrantEndedAt: new Date("2028-02-27T04:00:00.000Z"),
      isTrial: false,
      planType: null,
    });
  });

  it("두 sweep이 동시에 돌아도 보상 종료 알림은 하나다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:race", durationDays: 1 });
    const notify = context.module.get(NotifyEndingPremiumGrantsUseCase);
    const at = new Date("2028-02-26T06:00:00.000Z");

    // When
    const results = await Promise.all([
      notify.execute({ now: instantFromDate(at) }),
      notify.execute({ now: instantFromDate(at) }),
    ]);

    // Then
    expect(results.map((result) => result.notifiedCount).sort()).toEqual([0, 1]);
    expect(
      await client.$count(
        notification,
        and(eq(notification.userId, userId), eq(notification.type, "PREMIUM_GRANT_ENDING")),
      ),
    ).toBe(1);
  });

  it("보상 중에 산 스토어 구독이 보상 끝 뒤까지 이어지면 보상 종료 알림을 보내지 않는다", async () => {
    // Given
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:then-store",
      durationDays: 1,
    });
    await givenStoreSubscription();
    const notify = context.module.get(NotifyEndingPremiumGrantsUseCase);

    // When
    const result = await notify.execute({
      now: instantFromDate(new Date("2028-02-26T06:00:00.000Z")),
    });

    // Then
    expect(result.notifiedCount).toBe(0);
    expect(
      await client.$count(
        notification,
        and(eq(notification.userId, userId), eq(notification.type, "PREMIUM_GRANT_ENDING")),
      ),
    ).toBe(0);
  });

  it("스토어 구독이 웹훅 없이 끝나도 sweep이 그 시각부터 쌓아 둔 보상을 시작하고, 아직 유효한 구독의 보상은 그대로 둔다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:banked", durationDays: 7 });
    const coveredUser = UserFixture.create({
      id: createEntityId(),
      email: "premium-grant-covered@example.com",
      userTag: "PGRANT02",
      createdAt: instantFromDate(AT),
      updatedAt: instantFromDate(AT),
    });
    await client.insert(userTable).values(coveredUser);
    await saveSubscriptionFixture(subscriptions, {
      userId: coveredUser.id,
      storeSubscriptionId: "premium-grant-covered-chain",
      startedAt: instantFromDate(AT),
      expiresAt: instantFromDate(new Date("2028-04-01T04:00:00.000Z")),
    });
    await setUserSubscriptionProjection(projection, coveredUser.id, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date("2028-04-01T04:00:00.000Z"),
    });
    await granter.grant({
      userId: coveredUser.id,
      source: "INVITE",
      sourceKey: "invite:covered",
      durationDays: 7,
    });
    const sweep = context.module.get(SweepPremiumGrantsUseCase);

    // When
    const swept = await sweep.execute({
      now: instantFromDate(new Date("2028-03-11T04:00:00.000Z")),
    });

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
      createdAt: instantFromDate(AT),
      updatedAt: instantFromDate(AT),
    });
    await client.insert(userTable).values(user);
    return user.id;
  }

  it("RevenueCat 문서 샘플 TRANSFER는 넘겨받은 사용자에게 체인 행을 옮기고 두 사용자를 모두 다시 계산한다", async () => {
    // Given 넘겨준 사용자(현재 사용자)는 구독 중, 넘겨받은 사용자는 무료
    const giverAppUserId = "00005A1C-6091-4F81-BE77-F0A83A271AB6";
    const receiverAppUserId = "4BEDB450-8EF2-11E9-B475-0800200C9A66";
    const receiverId = await createUser("PGRANT0T");
    await client
      .update(userTable)
      .set({ revenueCatUserId: giverAppUserId })
      .where(eq(userTable.id, userId));
    await client
      .update(userTable)
      .set({ revenueCatUserId: receiverAppUserId })
      .where(eq(userTable.id, receiverId));
    await givenStoreSubscription();

    // When
    await context.module.get(RevenueCatWebhookReceiver).receive({
      body: {
        event: {
          app_id: "1234567890",
          event_timestamp_ms: 78789789798798,
          id: "CD489E0E-5D52-4E03-966B-A7F17788E432",
          store: "APP_STORE",
          transferred_from: [giverAppUserId],
          transferred_to: [receiverAppUserId],
          type: "TRANSFER",
          environment: "PRODUCTION",
        },
        api_version: "1.0",
      },
    });

    // Then
    expect(
      await client.query.subscription.findMany({
        columns: { userId: true },
        where: { revenueCatId: TRANSACTION_ID },
      }),
    ).toEqual([{ userId: receiverId }]);
    expect(await entitlement.canInTx(receiverId, "AI_REPORT")).toBe(true);
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(false);
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(
      await client.query.subscriptionEventReceipt.findFirst({
        columns: { eventType: true },
        where: { eventId: "CD489E0E-5D52-4E03-966B-A7F17788E432" },
      }),
    ).toEqual({ eventType: "TRANSFER" });
  });

  it("TRANSFER로 넘겨준 구독 행은 보상 기간이 User를 ACTIVE로 바꿔도 프리미엄을 늘리지 않는다", async () => {
    // Given
    const receiverId = await createUser("PGRANT03");
    await saveSubscriptionFixture(subscriptions, {
      userId: userId,
      storeSubscriptionId: "transferred-chain",
      startedAt: instantFromDate(AT),
      expiresAt: instantFromDate(new Date("2028-03-17T04:00:00.000Z")),
    });
    await setUserSubscriptionProjection(projection, userId, {
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    const transfer = SubscriptionEventBuilder.transfer()
      .withAppUserId(receiverId)
      .withTransferredFrom([userId])
      .withEventId("transfer-away")
      .build();
    await context.module.get(RevenueCatWebhookReceiver).receive({ body: transfer });
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:transfer",
      durationDays: 7,
    });
    const grantEndsAt = new Date("2028-03-04T04:00:00.000Z");

    // When
    vi.setSystemTime(grantEndsAt);
    const swept = await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(grantEndsAt) });

    // Then
    expect(swept).toMatchObject({ userCount: 1, failedUserCount: 0 });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(false);
    expect(
      await context.module
        .get<PremiumAccessReaderPort>(PremiumAccessReaderPort)
        .getPremiumAccess(userId),
    ).toMatchObject({ source: null, endsAt: null });
  });

  it("TRANSFER로 구독을 받은 사용자는 보상을 받아도 보상 종료 시각에 프리미엄이 끊기지 않는다", async () => {
    // Given
    const giverId = await createUser("PGRANT06");
    await saveSubscriptionFixture(subscriptions, {
      userId: giverId,
      storeSubscriptionId: "received-chain",
      startedAt: instantFromDate(AT),
      expiresAt: instantFromDate(STORE_EXPIRY),
    });
    const transfer = SubscriptionEventBuilder.transfer()
      .withAppUserId(userId)
      .withTransferredFrom([giverId])
      .withEventId("transfer-in")
      .build();
    await context.module.get(RevenueCatWebhookReceiver).receive({ body: transfer });

    // When
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:receiver",
      durationDays: 7,
    });
    const grantWouldEndAt = new Date("2028-03-04T04:00:00.000Z");
    vi.setSystemTime(grantWouldEndAt);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(grantWouldEndAt) });

    // Then
    expect(await grantsOf(userId)).toEqual([
      { sourceKey: "invite:receiver", status: "BANKED", startsAt: null, endsAt: null },
    ]);
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(true);
    expect(await premiumAccess()).toMatchObject({
      source: "STORE",
      periodEndsAt: STORE_EXPIRY,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(
      await context.module
        .get<PremiumAccessReaderPort>(PremiumAccessReaderPort)
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
    const before = await entitlement.canInTx(userId, "AI_REPORT");

    // When
    vi.setSystemTime(endsAt);
    const atEnd = await entitlement.canInTx(userId, "AI_REPORT");

    // Then
    expect([before, atEnd]).toEqual([true, false]);
    expect((await userProjection())?.subscriptionStatus).toBe("ACTIVE");
  });

  it("자동 갱신 구독은 만료 뒤 유예 시간 동안 쌓아 둔 보상을 시작하지 않고 그 뒤에야 시작한다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:grace", durationDays: 7 });
    const sweep = context.module.get(SweepPremiumGrantsUseCase);
    const inGrace = new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS - 1);
    const afterGrace = new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS);

    // When
    vi.setSystemTime(inGrace);
    const duringGrace = await sweep.execute({ now: instantFromDate(inGrace) });
    const premiumDuringGrace = await entitlement.canInTx(userId, "AI_REPORT");
    vi.setSystemTime(afterGrace);
    const pastGrace = await sweep.execute({ now: instantFromDate(afterGrace) });

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
      .get<PremiumAccessReaderPort>(PremiumAccessReaderPort)
      .getPremiumAccess(userId);
  }

  it("보상 기간 중 구독을 사면 진행 중인 기간을 구매 시각에 끝내고 남은 일수를 스토어 뒤로 다시 쌓는다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:g1", durationDays: 7 });
    // 받은 순서가 createdAt이라 같은 시각에 받으면 순서가 id로 갈린다. 실제 지급처럼 시각을 띄운다
    vi.setSystemTime(new Date(AT.getTime() + 1_000));
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:g2", durationDays: 7 });
    const beforePurchase = await premiumAccess();
    const purchasedAt = new Date("2028-02-28T04:00:00.000Z");
    vi.setSystemTime(purchasedAt);
    const webhook = context.module.get(RevenueCatWebhookReceiver);

    // When
    await webhook.receive({ body: purchase("purchase-during-grant", purchasedAt) });
    await webhook.receive({ body: purchase("purchase-during-grant", purchasedAt) });
    await webhook.receive({ body: purchase("purchase-redelivered", purchasedAt) });
    const afterPurchase = await premiumAccess();
    vi.setSystemTime(STORE_EXPIRY);
    await webhook.receive({
      body: storeEvent(SubscriptionEventBuilder.expiration(), "store-expired-after-grants"),
    });

    // Then
    expect(beforePurchase).toEqual({
      source: "GRANT",
      endsAt: new Date("2028-03-11T04:00:00.000Z"),
      periodEndsAt: new Date("2028-03-04T04:00:00.000Z"),
      willRenew: false,
      bankedDays: 7,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
    expect(afterPurchase).toEqual({
      source: "STORE",
      endsAt: new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 12 * DAY_MS),
      periodEndsAt: STORE_EXPIRY,
      willRenew: true,
      bankedDays: 12,
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
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
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
  });

  it("구매 웹훅·sweep·보상 지급이 동시에 와도 남은 기간은 한 번만 다시 쌓고 새 보상은 그 뒤에 쌓는다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:running", durationDays: 7 });
    const purchasedAt = new Date("2028-02-29T15:00:00.000Z");
    vi.setSystemTime(purchasedAt);
    const webhook = context.module.get(RevenueCatWebhookReceiver);
    const sweep = context.module.get(SweepPremiumGrantsUseCase);

    // When
    await Promise.all([
      webhook.receive({ body: purchase("concurrent-purchase", purchasedAt) }),
      sweep.execute({ now: instantFromDate(purchasedAt) }),
      granter.grant({ userId, source: "INVITE", sourceKey: "invite:concurrent", durationDays: 7 }),
    ]);
    // 같은 사용자 웹훅 잠금 경합(SUBSCRIPTION_1605)은 RevenueCat이 다시 보내므로 재전송은 뒤에 온다
    await webhook.receive({ body: purchase("concurrent-purchase-redelivered", purchasedAt) });
    await sweep.execute({ now: instantFromDate(purchasedAt) });

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
    const webhook = context.module.get(RevenueCatWebhookReceiver);
    await webhook.receive({
      body: storeEvent(SubscriptionEventBuilder.cancellation(), "store-cancelled"),
    });
    const notify = context.module.get(NotifyEndingPremiumGrantsUseCase);
    const sweep = context.module.get(SweepPremiumGrantsUseCase);
    const finalEndsAt = new Date(STORE_EXPIRY.getTime() + 7 * DAY_MS);

    // When
    const beforeHandoff = await notify.execute({
      now: instantFromDate(new Date("2028-03-09T06:00:00.000Z")),
    });
    vi.setSystemTime(new Date(STORE_EXPIRY.getTime() - 1));
    const premiumJustBefore = await entitlement.canInTx(userId, "AI_REPORT");
    vi.setSystemTime(STORE_EXPIRY);
    const premiumAtHandoff = await entitlement.canInTx(userId, "AI_REPORT");
    const lateSweepAt = new Date(STORE_EXPIRY.getTime() + 10 * 60 * 1_000);
    vi.setSystemTime(lateSweepAt);
    await sweep.execute({ now: instantFromDate(lateSweepAt) });
    const beforeFinalEnd = await notify.execute({
      now: instantFromDate(new Date("2028-03-16T06:00:00.000Z")),
    });

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
    const webhook = context.module.get(RevenueCatWebhookReceiver);
    await webhook.receive({
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
    await webhook.receive({ body: renewal });
    await webhook.receive({ body: renewal });

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
      recentGrantEndedAt: null,
      isTrial: false,
      planType: null,
    });
  });

  it("보상 기간이 끝난 뒤 받은 보상은 쌓지 않고 바로 시작한다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:first", durationDays: 7 });
    const afterFirst = new Date("2028-03-05T04:00:00.000Z");
    vi.setSystemTime(afterFirst);
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(afterFirst) });

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
    await client.insert(premiumGrant).values({
      userId,
      source: "INVITE",
      sourceKey: "invite:legacy-future",
      durationDays: 7,
      status: "ACTIVE",
      startsAt: Temporal.Instant.from("2028-03-01T04:00:00.000Z"),
      endsAt: Temporal.Instant.from("2028-03-08T04:00:00.000Z"),
      updatedAt: instantFromDate(AT),
    });

    // When
    const swept = await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(AT) });

    // Then
    expect(swept).toMatchObject({ userCount: 1, changedGrantCount: 1 });
    expect(await grantsOf(userId)).toEqual([
      { sourceKey: "invite:legacy-future", status: "BANKED", startsAt: null, endsAt: null },
    ]);
  });

  async function roleOf(target: string) {
    return (await client.query.user.findFirst({ columns: { role: true }, where: { id: target } }))
      ?.role;
  }

  it("ADMIN도 보상 기간을 기록하고 종료 안내를 받지만 role과 무제한 한도는 그대로다", async () => {
    // Given
    await client.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, userId));
    const notify = context.module.get(NotifyEndingPremiumGrantsUseCase);
    const sweep = context.module.get(SweepPremiumGrantsUseCase);

    // When
    const granted = await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:admin",
      durationDays: 1,
    });
    const notified = await notify.execute({
      now: instantFromDate(new Date("2028-02-26T06:00:00.000Z")),
    });
    const endedAt = new Date("2028-02-27T04:00:00.000Z");
    vi.setSystemTime(endedAt);
    await sweep.execute({ now: instantFromDate(endedAt) });

    // Then
    expect(granted.status).toBe("granted");
    expect(notified.notifiedCount).toBe(1);
    expect(await grantsOf(userId)).toEqual([
      expect.objectContaining({ sourceKey: "invite:admin", status: "ENDED" }),
    ]);
    expect(await roleOf(userId)).toBe("ADMIN");
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(true);
    expect(await entitlement.getLimitInTx(userId, "FRIEND")).toBeNull();
  });

  it.each([
    { name: "EXPIRATION", builder: SubscriptionEventBuilder.expiration },
    { name: "CANCELLATION", builder: SubscriptionEventBuilder.cancellation },
    { name: "환불 CANCELLATION", builder: SubscriptionEventBuilder.refundCancellation },
  ])("ADMIN의 스토어 $name 웹훅은 role을 바꾸지 않는다", async ({ builder }) => {
    // Given
    await client.update(userTable).set({ role: "ADMIN" }).where(eq(userTable.id, userId));
    await givenStoreSubscription();
    await granter.grant({
      userId,
      source: "INVITE",
      sourceKey: "invite:admin-store",
      durationDays: 7,
    });
    vi.setSystemTime(STORE_EXPIRY);

    // When
    await context.module
      .get(RevenueCatWebhookReceiver)
      .receive({ body: storeEvent(builder(), "admin-store") });
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(STORE_EXPIRY) });

    // Then
    expect(await roleOf(userId)).toBe("ADMIN");
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(true);
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
    const source = context.module.get(PremiumGrantEndingNoticeRepositoryPort);
    const params = {
      now: Temporal.Instant.from("2028-02-26T06:00:00.000Z"),
      endsBefore: Temporal.Instant.from("2028-02-28T00:00:00.000Z"),
    };

    // When
    const first = await source.listDue({ ...params, limit: 1 });
    const rest = await source.listDue({ ...params, after: first.at(-1), limit: 10 });

    // Then
    expect(first).toHaveLength(1);
    expect(rest).toHaveLength(2);
    expect(new Set([...first, ...rest].map((notice) => notice.userId))).toEqual(new Set(userIds));
  });
  it("만료 웹훅을 잃은 자동 갱신 구독자는 유예 안에서는 그대로 두고 유예가 지나면 sweep이 FREE로 정리한다", async () => {
    // Given
    await givenStoreSubscription();
    const sweep = context.module.get(SweepPremiumGrantsUseCase);
    const inGrace = new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS - 1);
    const afterGrace = new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS);

    // When
    vi.setSystemTime(inGrace);
    const keptRun = await sweep.execute({ now: instantFromDate(inGrace) });
    const keptProjection = await userProjection();
    vi.setSystemTime(afterGrace);
    const lapsedRun = await sweep.execute({ now: instantFromDate(afterGrace) });
    const rerun = await sweep.execute({ now: instantFromDate(afterGrace) });

    // Then
    expect(keptRun.lapsedUserCount).toBe(0);
    expect(keptProjection).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: STORE_EXPIRY,
    });
    expect(lapsedRun).toMatchObject({ lapsedUserCount: 1, lapsedFailedUserCount: 0 });
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(rerun.lapsedUserCount).toBe(0);
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(false);
  });

  it("만료 웹훅을 잃은 구독자에게 쌓아 둔 보상이 있으면 sweep이 스토어가 끝난 시각부터 이어서 시작한다", async () => {
    // Given
    await givenStoreSubscription();
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:lapsed", durationDays: 7 });
    const afterGrace = new Date(STORE_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS);
    vi.setSystemTime(afterGrace);

    // When
    await context.module
      .get(SweepPremiumGrantsUseCase)
      .execute({ now: instantFromDate(afterGrace) });

    // Then
    expect(await userProjection()).toEqual({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: new Date(afterGrace.getTime() + 7 * DAY_MS),
    });
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(true);
  });
  it("잘못 준 보상을 취소하면 REVOKED로 남기고 프리미엄을 바로 끝내며 같은 취소는 바꾸지 않는다", async () => {
    // Given
    await granter.grant({ userId, source: "INVITE", sourceKey: "invite:wrong", durationDays: 7 });
    const revoke = context.module.get(RevokePremiumGrantUseCase);

    // When
    const first = await revoke.execute({ sourceKey: "invite:wrong", now: instantFromDate(AT) });
    const second = await revoke.execute({ sourceKey: "invite:wrong", now: instantFromDate(AT) });

    // Then
    expect(first).toEqual({ status: "revoked", userId, revokedGrantCount: 1 });
    expect(second).toEqual({ status: "unchanged" });
    expect(await grantsOf(userId)).toEqual([
      { sourceKey: "invite:wrong", status: "REVOKED", startsAt: AT, endsAt: AT },
    ]);
    expect(await userProjection()).toEqual({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(false);
  });
});
