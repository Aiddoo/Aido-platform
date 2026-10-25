import { and } from "@prisma/orm-postgres/orm-client";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { SUBSCRIPTION_REPOSITORY } from "#api/modules/billing/application/ports/subscriptions/subscription.repository.port";
import type { SubscriptionRepositoryPort } from "#api/modules/billing/application/ports/subscriptions/subscription.repository.port";
import { HandleWebhookEvent } from "#api/modules/billing/application/use-cases/subscriptions/handle-webhook-event.use-case";
import { NotifyEndingPremiumGrants } from "#api/modules/billing/application/use-cases/subscriptions/notify-ending-premium-grants.use-case";
import { SweepPremiumGrants } from "#api/modules/billing/application/use-cases/subscriptions/sweep-premium-grants.use-case";
import {
  PREMIUM_GRANTER,
  type PremiumGranterPort,
} from "#api/modules/billing/billing-subscriptions.public";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
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

  it("같은 보상을 동시에 여러 번 지급해도 한 번만 저장하고 기간을 이어 붙인다", async () => {
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
      {
        sourceKey: "invite:next",
        status: "ACTIVE",
        startsAt: new Date("2028-03-04T04:00:00.000Z"),
        endsAt: new Date("2028-03-07T04:00:00.000Z"),
      },
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
        startsAt: new Date("2028-03-11T04:00:00.000Z"),
        endsAt: new Date("2028-03-18T04:00:00.000Z"),
      },
    ]);
    expect((await grantsOf(coveredUser.id)).map((grant) => grant.status)).toEqual(["BANKED"]);
  });
});
