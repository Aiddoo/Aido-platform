import type { RevenueCatWebhookPayload } from "@aido/api";

import { STORE_RENEWAL_GRACE_MS } from "#api/modules/billing/shared/store-renewal-grace.domain-service";
import {
  PremiumAccessReaderPort,
  PremiumGranterPort,
} from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
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

const DAY_MS = 24 * 60 * 60 * 1000;
const AT = new Date("2028-02-26T04:00:00.000Z");
const FIRST_EXPIRY = new Date("2028-03-10T04:00:00.000Z");
const NEXT_EXPIRY = new Date("2028-04-10T04:00:00.000Z");
const RENEWED_AT = new Date(FIRST_EXPIRY.getTime() - 60 * 60 * 1000);
// 지난 기간이 자동 갱신 유예(3시간)까지 끝난 뒤라 그 만료 시각으로 되돌아가면 바로 무료가 된다
const LATE_AT = new Date(FIRST_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 60 * 60 * 1000);
const CHAIN = "edge-store-chain";

describe("결제 생애주기의 순서 뒤바뀜·환불 경계 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let granter: PremiumGranterPort;
  let userId: string;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 8 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    granter = context.module.get<PremiumGranterPort>(PremiumGranterPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "lifecycle-edge@example.com",
      userTag: "EDGE0001",
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

  function webhook(body: RevenueCatWebhookPayload) {
    return context.module.get(RevenueCatWebhookReceiver).receive({ body });
  }

  function chainEvent(
    builder: SubscriptionEventBuilder,
    eventId: string,
    expiresAt: Date,
    chain = CHAIN,
  ): RevenueCatWebhookPayload {
    return builder
      .withAppUserId(userId)
      .withOriginalTransactionId(chain)
      .withTransactionId(`${chain}-${eventId}`)
      .withEventId(eventId)
      .withPurchasedAtMs(AT.getTime())
      .withExpirationAtMs(expiresAt.getTime())
      .build();
  }

  function premiumAccess() {
    return context.module
      .get<PremiumAccessReaderPort>(PremiumAccessReaderPort)
      .getPremiumAccess(UserId.reconstitute(userId));
  }

  async function grantsOf() {
    const rows = await client.query.premiumGrant.findMany({
      columns: { sourceKey: true, status: true, startsAt: true, endsAt: true },
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      ...row,
      startsAt: toDateOrNull(row.startsAt),
      endsAt: toDateOrNull(row.endsAt),
    }));
  }

  async function storeRowsOf() {
    const rows = await client.query.subscription.findMany({
      columns: { revenueCatId: true, productId: true, status: true, expiresAt: true },
      where: { userId },
      orderBy: { id: "asc" },
    });
    return rows.map((row) => ({ ...row, expiresAt: toDateOrNull(row.expiresAt) }));
  }

  describe("늦게 도착한 지난 기간의 웹훅", () => {
    async function givenRenewedWithBankedInvite(): Promise<void> {
      await webhook(
        chainEvent(SubscriptionEventBuilder.initialPurchase(), "purchase", FIRST_EXPIRY),
      );
      await granter.grant({
        userId: UserId.reconstitute(userId),
        source: "INVITE",
        sourceKey: "edge:invite",
        durationDays: 7,
      });
      vi.setSystemTime(RENEWED_AT);
      await webhook(chainEvent(SubscriptionEventBuilder.renewal(), "renewal", NEXT_EXPIRY));
      vi.setSystemTime(LATE_AT);
    }

    it.each([
      ["해지(UNSUBSCRIBE)", () => SubscriptionEventBuilder.cancellation()],
      ["해지 철회", () => SubscriptionEventBuilder.uncancellation()],
      ["기간 연장", () => SubscriptionEventBuilder.subscriptionExtended()],
    ])(
      "갱신 뒤 도착한 지난 기간의 %s은 다음 기간의 자동 갱신과 쌓아 둔 보상을 되돌리지 않는다",
      async (_label, eventOf) => {
        // Given
        await givenRenewedWithBankedInvite();

        // When
        await webhook(chainEvent(eventOf(), "late-previous-period", FIRST_EXPIRY));

        // Then
        expect(await premiumAccess()).toEqual({
          source: "STORE",
          endsAt: new Date(NEXT_EXPIRY.getTime() + STORE_RENEWAL_GRACE_MS + 7 * DAY_MS),
          periodEndsAt: NEXT_EXPIRY,
          willRenew: true,
          isTrial: false,
          planType: null,
          bankedDays: 7,
          recentGrantEndedAt: null,
        });
        expect(await storeRowsOf()).toEqual([
          {
            revenueCatId: CHAIN,
            productId: "premium_monthly",
            status: "ACTIVE",
            expiresAt: NEXT_EXPIRY,
          },
        ]);
        expect(await grantsOf()).toEqual([
          { sourceKey: "edge:invite", status: "BANKED", startsAt: null, endsAt: null },
        ]);
      },
    );
  });

  it("환불 뒤 다시 온 환불과 늦은 만료는 이미 시작한 보상을 다시 시작하거나 두 번 세지 않는다", async () => {
    // Given
    await webhook(chainEvent(SubscriptionEventBuilder.initialPurchase(), "purchase", FIRST_EXPIRY));
    await granter.grant({
      userId: UserId.reconstitute(userId),
      source: "INVITE",
      sourceKey: "refund:invite",
      durationDays: 7,
    });
    const refundedAt = new Date("2028-03-01T04:00:00.000Z");
    vi.setSystemTime(refundedAt);
    await webhook(
      chainEvent(SubscriptionEventBuilder.refundCancellation(), "refund", FIRST_EXPIRY),
    );

    // When
    vi.setSystemTime(new Date(refundedAt.getTime() + DAY_MS));
    await webhook(
      chainEvent(SubscriptionEventBuilder.refundCancellation(), "refund-resent", FIRST_EXPIRY),
    );
    await webhook(chainEvent(SubscriptionEventBuilder.expiration(), "late-expire", FIRST_EXPIRY));

    // Then
    const grantEndsAt = new Date(refundedAt.getTime() + 7 * DAY_MS);
    expect(await grantsOf()).toEqual([
      { sourceKey: "refund:invite", status: "ACTIVE", startsAt: refundedAt, endsAt: grantEndsAt },
    ]);
    expect(await premiumAccess()).toMatchObject({
      source: "GRANT",
      endsAt: grantEndsAt,
      periodEndsAt: grantEndsAt,
      bankedDays: 0,
    });
  });
});
