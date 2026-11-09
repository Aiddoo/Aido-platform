import type { RevenueCatWebhookPayload } from "@aido/api";
import { eq, sql } from "drizzle-orm";
import { sortBy } from "es-toolkit";

import { ENTITLEMENT_READER } from "#api/modules/access/access-entitlement.public";
import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import {
  SUBSCRIPTION_EVENT_NOTIFIER,
  type SubscriptionEventNotifierPort,
} from "#api/modules/billing/application/ports/subscriptions/subscription-event-notifier.port";
import {
  SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY,
  type SubscriptionEventReceiptRepositoryPort,
} from "#api/modules/billing/application/ports/subscriptions/subscription-event-receipt.repository.port";
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepositoryPort,
} from "#api/modules/billing/application/ports/subscriptions/subscription.repository.port";
import type { SubscriptionEventPayload } from "#api/modules/billing/application/types/subscriptions/subscription-event.payload";
import { StoreSubscriptionId } from "#api/modules/billing/domain/value-objects/subscriptions/store-subscription-id.vo";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/infrastructure/revenuecat/revenuecat-webhook.receiver";
import { databaseSqlState } from "#api/platform/database/database-error.util";
import { createEntityId } from "#api/platform/database/entity-id";
import { subscriptionEventReceipt, user as userTable } from "#api/platform/database/schema/index";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
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

const at = new Date("2027-01-04T12:00:00.000Z");
const previousExpiry = new Date("2027-01-03T12:00:00.000Z");
const nextExpiry = new Date("2027-02-03T12:00:00.000Z");
const previousEventAt = at.getTime() - 2_000;
const renewedEventAt = at.getTime() - 1_000;

const events: SubscriptionEventPayload[] = [];
const failures: unknown[] = [];
const notifier: SubscriptionEventNotifierPort = {
  notifySubscriptionEvent: (payload) => {
    events.push(payload);
  },
  recordBillingIssue: async () => {},
  reportWebhookFailure: (error) => {
    failures.push(error);
  },
};

describe("구독 이벤트 처리 원장과 상태 전이 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let repository: SubscriptionRepositoryPort;
  let useCase: RevenueCatWebhookReceiver;
  let entitlement: EntitlementReaderPort;
  let receipts: SubscriptionEventReceiptRepositoryPort;
  let unitOfWork: UnitOfWorkPort;
  let userId: string;
  const transactionId = "billing-existing-transaction";

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(SUBSCRIPTION_EVENT_NOTIFIER).useValue(notifier),
    });
    repository = context.module.get(SUBSCRIPTION_REPOSITORY);
    useCase = context.module.get(RevenueCatWebhookReceiver);
    entitlement = context.module.get<EntitlementReaderPort>(ENTITLEMENT_READER);
    receipts = context.module.get(SUBSCRIPTION_EVENT_RECEIPT_REPOSITORY);
    unitOfWork = context.module.get(UNIT_OF_WORK);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    events.length = 0;
    failures.length = 0;
    const user = UserFixture.create({
      id: createEntityId(),
      email: "billing-owner@example.com",
      revenueCatUserId: "billing-owner-alias",
      userTag: "BILLBF01",
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: previousExpiry,
      createdAt: at,
      updatedAt: at,
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    await repository.create({
      userId,
      storeSubscriptionId: StoreSubscriptionId.from(transactionId),
      productId: "premium_monthly",
      status: "ACTIVE",
      startedAt: new Date("2026-12-03T12:00:00.000Z"),
      expiresAt: previousExpiry,
      lastProcessedEventId: "seed-existing-subscription",
    });
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  function expiration(eventId: string): RevenueCatWebhookPayload {
    const payload = SubscriptionEventBuilder.expiration()
      .withAppUserId(userId)
      .withOriginalTransactionId(transactionId)
      .withTransactionId(transactionId)
      .withEventId(eventId)
      .withExpirationAtMs(previousExpiry.getTime())
      .build();
    payload.event.event_timestamp_ms = previousEventAt;
    return payload;
  }

  function renewal(): RevenueCatWebhookPayload {
    const payload = SubscriptionEventBuilder.renewal()
      .withAppUserId(userId)
      .withOriginalTransactionId(transactionId)
      .withTransactionId(transactionId)
      .withEventId("B-new-renewal")
      .withExpirationAtMs(nextExpiry.getTime())
      .build();
    payload.event.event_timestamp_ms = renewedEventAt;
    return payload;
  }

  async function snapshot() {
    const subscription = await repository.findByStoreSubscriptionId(
      StoreSubscriptionId.from(transactionId),
    );
    const user = await client.query.user.findFirst({ where: { id: userId } });
    return {
      subscriptionStatus: subscription?.status,
      lastProcessedEventId: subscription?.lastProcessedEventId,
      storedSubscriptionExpiry: subscription?.expiresAt.toISOString(),
      userStatus: user?.subscriptionStatus,
      userExpiry: user?.subscriptionExpiresAt?.toISOString() ?? null,
      premiumAccess: await entitlement.can(userId, "AI_REPORT"),
    };
  }

  it("SANDBOX 구매도 프리미엄을 주고 구독 행·처리 원장에 결제 환경을 남긴다", async () => {
    // Given
    const sandboxTransactionId = "billing-sandbox-transaction";
    const body = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(userId)
      .withOriginalTransactionId(sandboxTransactionId)
      .withTransactionId(sandboxTransactionId)
      .withEventId("sandbox-purchase")
      .withPurchasedAtMs(at.getTime())
      .withExpirationAtMs(nextExpiry.getTime())
      .withEnvironment("SANDBOX")
      .build();

    // When
    await useCase.receive({ body });

    // Then
    const stored = await client.query.subscription.findFirst({
      columns: { environment: true },
      where: { revenueCatId: sandboxTransactionId },
    });
    const receipt = await client.query.subscriptionEventReceipt.findFirst({
      columns: { environment: true },
      where: { eventId: "sandbox-purchase" },
    });
    expect(stored?.environment).toBe("SANDBOX");
    expect(receipt?.environment).toBe("SANDBOX");
    expect(events.at(-1)?.environment).toBe("SANDBOX");
    expect(await entitlement.canInTx(userId, "AI_REPORT")).toBe(true);
  });

  it("A 만료→B 갱신→동일 A 재전송은 최신 프리미엄 권한을 유지해야 한다", async () => {
    // Given
    const oldEvent = expiration("A-previous-expiration");
    await useCase.receive({ body: oldEvent });
    await useCase.receive({ body: renewal() });
    const beforeReplay = await snapshot();
    expect(beforeReplay.premiumAccess).toBe(true);
    expect(beforeReplay.userStatus).toBe("ACTIVE");

    // When
    const response = await useCase.receive({ body: oldEvent });
    const afterReplay = await snapshot();

    // Then
    expect(failures).toEqual([]);
    expect(response).toEqual({ received: true });
    expect(afterReplay.userStatus).toBe("ACTIVE");
    expect(afterReplay.premiumAccess).toBe(true);
    expect(afterReplay.lastProcessedEventId).toBe("B-new-renewal");
    expect(events).toHaveLength(2);
    expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(2);
  });

  it("최신 갱신 뒤 도착한 별도 id의 과거 만료는 최신 프리미엄 권한을 유지해야 한다", async () => {
    // Given
    await useCase.receive({ body: renewal() });
    const beforeDelayedEvent = await snapshot();
    expect(beforeDelayedEvent.premiumAccess).toBe(true);
    expect(beforeDelayedEvent.userStatus).toBe("ACTIVE");

    // When
    const response = await useCase.receive({ body: expiration("C-delayed-previous-expiration") });
    const afterDelayedEvent = await snapshot();

    // Then
    expect(failures).toEqual([]);
    expect(response).toEqual({ received: true });
    expect(afterDelayedEvent.userStatus).toBe("ACTIVE");
    expect(afterDelayedEvent.premiumAccess).toBe(true);
    expect(afterDelayedEvent.lastProcessedEventId).toBe("B-new-renewal");
    expect(events).toHaveLength(1);
    expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(2);
  });

  function initialPurchase(appUserId = userId) {
    return SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(appUserId)
      .withOriginalTransactionId("new-subscription-chain")
      .withTransactionId("new-subscription-chain")
      .withEventId("initial-purchase-event")
      .withPurchasedAtMs(at.getTime())
      .withExpirationAtMs(nextExpiry.getTime())
      .build();
  }

  async function holdUserLock() {
    const released = Promise.withResolvers<void>();
    const acquired = Promise.withResolvers<void>();
    const holding = client.transaction(async (transaction) => {
      await transaction
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .for("no key update");
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("경쟁 요청 전에 사용자 잠금이 해제되었습니다.");
      }),
    ]);
    return {
      async release() {
        released.resolve();
        await holding;
      },
    };
  }

  it("사용자 id와 RevenueCat alias로 같은 이벤트가 동시에 도착해도 한 번만 반영한다", async () => {
    // Given
    const lock = await holdUserLock();
    const responses = Promise.allSettled([
      useCase.receive({ body: initialPurchase() }),
      useCase.receive({ body: initialPurchase("billing-owner-alias") }),
    ]);

    // When
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client.execute<{ count: number }>(sql`
            SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query ILIKE '%User%FOR NO KEY UPDATE%'
          `);
          expect(waiting.rows[0]?.count).toBe(2);
        },
        { timeout: 10_000 },
      );
    } finally {
      await lock.release();
      await responses;
    }

    // Then
    expect((await responses).map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(failures).toEqual([]);
    expect(
      await repository.findByStoreSubscriptionId(
        StoreSubscriptionId.from("new-subscription-chain"),
      ),
    ).toMatchObject({
      status: "ACTIVE",
      lastProcessedEventId: "initial-purchase-event",
      expiresAt: nextExpiry,
    });
    expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(await entitlement.can(userId, "AI_REPORT")).toBe(true);
  });

  it("구독 INSERT의 실제 FK 오류는 처리 원장도 rollback하고 던져, 다시 보낸 같은 이벤트를 처리할 수 있다", async () => {
    // Given
    const createSubscription = repository.create.bind(repository);
    const failure = vi
      .spyOn(repository, "create")
      .mockImplementationOnce((data) => createSubscription({ ...data, userId: createEntityId() }));

    // When
    const firstAttempt = await useCase
      .receive({ body: initialPurchase() })
      .catch((error: unknown) => error)
      .finally(() => failure.mockRestore());

    // Then
    expect(databaseSqlState(firstAttempt)).toBe("23503");
    expect(failures).toEqual([]);
    expect(await client.select().from(subscriptionEventReceipt)).toEqual([]);
    expect(
      await repository.findByStoreSubscriptionId(
        StoreSubscriptionId.from("new-subscription-chain"),
      ),
    ).toBeNull();
    expect((await snapshot()).userExpiry).toBe(previousExpiry.toISOString());
    expect(events).toEqual([]);
    await expect(useCase.receive({ body: initialPurchase() })).resolves.toEqual({ received: true });
    expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(1);
    expect(
      await repository.findByStoreSubscriptionId(
        StoreSubscriptionId.from("new-subscription-chain"),
      ),
    ).toMatchObject({
      status: "ACTIVE",
    });
    expect(events).toHaveLength(1);
  });

  it("사용자 projection 갱신 실패는 먼저 생성한 구독과 처리 원장도 rollback하고 던진다", async () => {
    // Given
    const updateUser = repository.updateUserSubscriptionStatus.bind(repository);
    const failure = vi
      .spyOn(repository, "updateUserSubscriptionStatus")
      .mockImplementationOnce((_userId, data) => updateUser(createEntityId(), data));

    // When
    const firstAttempt = useCase
      .receive({ body: initialPurchase() })
      .finally(() => failure.mockRestore());

    // Then
    await expect(firstAttempt).rejects.toBeInstanceOf(Error);
    expect(failures).toEqual([]);
    expect(
      await repository.findByStoreSubscriptionId(
        StoreSubscriptionId.from("new-subscription-chain"),
      ),
    ).toBeNull();
    expect(await client.select().from(subscriptionEventReceipt)).toEqual([]);
    expect((await snapshot()).userExpiry).toBe(previousExpiry.toISOString());
    expect(events).toEqual([]);
    await useCase.receive({ body: initialPurchase() });
    expect(
      await repository.findByStoreSubscriptionId(
        StoreSubscriptionId.from("new-subscription-chain"),
      ),
    ).toMatchObject({
      status: "ACTIVE",
    });
    expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it("같은 트랜잭션에서 중복 claim을 건너뛰어도 뒤의 사용자 변경을 커밋한다", async () => {
    // Given
    const input = {
      eventId: "duplicate-in-same-transaction",
      eventType: "RENEWAL",
      processedAt: at,
    };

    // When
    await unitOfWork.run(async () => {
      expect(await receipts.claim(input)).toBe(true);
      expect(await receipts.claim(input)).toBe(false);
      await repository.updateUserSubscriptionStatus(userId, { subscriptionStatus: "CANCELLED" });
    });

    // Then
    expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(1);
    expect((await snapshot()).userStatus).toBe("CANCELLED");
  });

  it("배포 이전 마지막 이벤트 id의 재전송은 원장에 흡수하고 부수 효과를 반복하지 않는다", async () => {
    // Given
    const payload = renewal();
    payload.event.id = "seed-existing-subscription";

    // When
    await useCase.receive({ body: payload });

    // Then
    expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(1);
    expect((await snapshot()).lastProcessedEventId).toBe("seed-existing-subscription");
    expect((await snapshot()).userExpiry).toBe(previousExpiry.toISOString());
    expect(events).toEqual([]);
    expect(failures).toEqual([]);
  });

  it.each(["same-period", "missing-period"])(
    "id와 생성 시각이 없는 legacy 만료 %s는 기존 동작을 유지한다",
    async (period) => {
      // Given
      await useCase.receive({ body: renewal() });
      const payload = expiration("unused-id");
      payload.event.id = undefined;
      payload.event.event_timestamp_ms = undefined;
      payload.event.expiration_at_ms = period === "same-period" ? nextExpiry.getTime() : undefined;

      // When
      await useCase.receive({ body: payload });

      // Then
      expect(await snapshot()).toMatchObject({
        subscriptionStatus: "EXPIRED",
        userStatus: "FREE",
        userExpiry: null,
        premiumAccess: false,
        lastProcessedEventId: "B-new-renewal",
      });
      expect(events).toHaveLength(2);
      expect(await client.select().from(subscriptionEventReceipt)).toHaveLength(1);
      expect(failures).toEqual([]);
    },
  );
  async function givenOtherSubscription(
    overrides: Partial<Parameters<SubscriptionRepositoryPort["create"]>[0]> = {},
  ) {
    await repository.create({
      userId,
      storeSubscriptionId: StoreSubscriptionId.from("other-subscription-chain"),
      productId: "premium_monthly",
      status: "ACTIVE",
      startedAt: at,
      expiresAt: nextExpiry,
      ...overrides,
    });
  }

  async function givenActiveUserProjection() {
    await repository.updateUserSubscriptionStatus(userId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: nextExpiry,
    });
  }

  it.each([
    { name: "만료", builder: SubscriptionEventBuilder.expiration },
    { name: "환불", builder: SubscriptionEventBuilder.refundCancellation },
  ])("과거 체인의 $name 이벤트는 다른 최신 활성 체인의 권한을 보존한다", async ({ builder }) => {
    // Given
    await givenActiveUserProjection();
    await givenOtherSubscription();
    expect(await entitlement.can(userId, "AI_REPORT")).toBe(true);
    const body = builder()
      .withAppUserId(userId)
      .withOriginalTransactionId(transactionId)
      .withTransactionId(transactionId)
      .withEventId("old-chain-negative-event")
      .withExpirationAtMs(previousExpiry.getTime())
      .build();

    // When
    await useCase.receive({ body });

    // Then
    expect(
      await repository.findByStoreSubscriptionId(StoreSubscriptionId.from(transactionId)),
    ).toMatchObject({ status: "EXPIRED" });
    expect(
      await repository.findByStoreSubscriptionId(
        StoreSubscriptionId.from("other-subscription-chain"),
      ),
    ).toMatchObject({
      status: "ACTIVE",
      expiresAt: nextExpiry,
    });
    expect(await snapshot()).toMatchObject({
      userStatus: "ACTIVE",
      userExpiry: nextExpiry.toISOString(),
      premiumAccess: true,
    });
    expect(events).toHaveLength(1);
    expect(failures).toEqual([]);
  });

  it("다른 활성 체인의 만료일이 더 짧으면 사용자 권한도 그 기간으로 제한한다", async () => {
    // Given
    const shorterExpiry = new Date("2027-01-05T12:00:00.000Z");
    await givenActiveUserProjection();
    await givenOtherSubscription({ expiresAt: shorterExpiry });

    // When
    await useCase.receive({ body: expiration("shorter-other-chain-expiration") });

    // Then
    expect(await snapshot()).toMatchObject({
      userStatus: "ACTIVE",
      userExpiry: shorterExpiry.toISOString(),
      premiumAccess: true,
    });
    expect(failures).toEqual([]);
  });

  it("취소됐지만 미래까지 유효한 다른 체인도 기존 활성 권한을 보존한다", async () => {
    // Given
    await givenActiveUserProjection();
    await givenOtherSubscription({ status: "CANCELLED" });

    // When
    await useCase.receive({ body: expiration("other-cancelled-chain-expiration") });

    // Then
    expect(await snapshot()).toMatchObject({
      userStatus: "ACTIVE",
      userExpiry: nextExpiry.toISOString(),
      premiumAccess: true,
    });
    expect(
      await repository.findByStoreSubscriptionId(
        StoreSubscriptionId.from("other-subscription-chain"),
      ),
    ).toMatchObject({
      status: "CANCELLED",
    });
    expect(failures).toEqual([]);
  });

  it("권한 조회는 대상 체인·환불/무료·만료 경계·다른 사용자의 구독을 제외한다", async () => {
    // Given
    await givenActiveUserProjection();
    const distantExpiry = new Date("2028-01-04T12:00:00.000Z");
    await repository.updateStatus(StoreSubscriptionId.from(transactionId), {
      expiresAt: distantExpiry,
    });
    await givenOtherSubscription({
      storeSubscriptionId: StoreSubscriptionId.from("refunded-other"),
      status: "EXPIRED",
      expiresAt: distantExpiry,
    });
    await givenOtherSubscription({
      storeSubscriptionId: StoreSubscriptionId.from("free-other"),
      status: "FREE",
      expiresAt: distantExpiry,
    });
    await givenOtherSubscription({
      storeSubscriptionId: StoreSubscriptionId.from("expired-boundary-other"),
      status: "ACTIVE",
      expiresAt: new Date(at.getTime() - STORE_RENEWAL_GRACE_MS),
    });
    const foreignUser = UserFixture.create({
      id: createEntityId(),
      email: "foreign-billing@example.com",
      userTag: "BILLF001",
    });
    await client.insert(userTable).values(foreignUser);
    await givenOtherSubscription({
      storeSubscriptionId: StoreSubscriptionId.from("foreign-other"),
      userId: foreignUser.id,
      expiresAt: distantExpiry,
    });
    const body = expiration("exclude-ineligible-chains");
    body.event.expiration_at_ms = distantExpiry.getTime();

    // When
    await useCase.receive({ body });

    // Then
    expect(await snapshot()).toMatchObject({
      userStatus: "FREE",
      userExpiry: null,
      premiumAccess: false,
    });
    expect(failures).toEqual([]);
  });

  it("스토어 엔타이틀먼트 조회는 한 사용자의 체인 전체를 한 번에 읽는다", async () => {
    // Given
    const shorterExpiry = new Date("2027-01-05T12:00:00.000Z");
    await givenOtherSubscription({
      storeSubscriptionId: StoreSubscriptionId.from("shorter-other"),
      expiresAt: shorterExpiry,
    });
    await givenOtherSubscription({ status: "CANCELLED", expiresAt: nextExpiry });

    // When
    const entitlements = await repository.findStoreEntitlements(userId);

    // Then
    expect(sortBy(entitlements, [(entitlement) => entitlement.storeSubscriptionId])).toEqual([
      {
        storeSubscriptionId: transactionId,
        productId: "premium_monthly",
        startedAt: new Date("2026-12-03T12:00:00.000Z"),
        status: "ACTIVE",
        expiresAt: previousExpiry,
        gracePeriodEndsAt: null,
        periodType: null,
      },
      {
        storeSubscriptionId: "other-subscription-chain",
        productId: "premium_monthly",
        startedAt: new Date("2027-01-04T12:00:00.000Z"),
        status: "CANCELLED",
        expiresAt: nextExpiry,
        gracePeriodEndsAt: null,
        periodType: null,
      },
      {
        storeSubscriptionId: "shorter-other",
        productId: "premium_monthly",
        startedAt: new Date("2027-01-04T12:00:00.000Z"),
        status: "ACTIVE",
        expiresAt: shorterExpiry,
        gracePeriodEndsAt: null,
        periodType: null,
      },
    ]);
  });

  it.each(["FREE", "CANCELLED"] as const)(
    "기존 %s 사용자의 다른 활성 체인이 다른 사용자에게 옮겨 갔으면 권한을 되살리지 않는다",
    async (subscriptionStatus) => {
      // Given
      await repository.updateUserSubscriptionStatus(userId, {
        subscriptionStatus,
        subscriptionExpiresAt: nextExpiry,
      });
      await givenOtherSubscription();
      const receiver = UserFixture.create({
        id: createEntityId(),
        email: `transfer-receiver-${subscriptionStatus.toLowerCase()}@example.com`,
        userTag: `BILLT${subscriptionStatus.slice(0, 3)}`,
      });
      await client.insert(userTable).values(receiver);
      await repository.takeOverChains(userId, receiver.id);
      await repository.claimChain(StoreSubscriptionId.from(transactionId), userId);

      // When
      await useCase.receive({ body: expiration("no-automatic-reactivation") });

      // Then
      expect(await snapshot()).toMatchObject({
        userStatus: "FREE",
        userExpiry: null,
        premiumAccess: false,
      });
      expect(failures).toEqual([]);
    },
  );
});
