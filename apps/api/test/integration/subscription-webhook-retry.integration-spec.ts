import type { RevenueCatWebhookPayload } from "@aido/api";

import { SubscriptionEventNotifierPort } from "#api/modules/billing/subscriptions/application/ports/subscription-event-notifier.port";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { user as userTable } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { instantFromDate } from "#api/shared/domain/time/instant";
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
const expiresAt = new Date("2027-01-10T12:00:00.000Z");
const graceEndsAt = new Date("2027-01-26T12:00:00.000Z");
const CHAIN = "retry-chain";

/** 결제 문제 푸시 기록을 정해진 횟수만큼 일시 실패시킨다(같은 트랜잭션의 DB 장애 대역). */
class FlakyBillingIssueNotifier implements SubscriptionEventNotifierPort {
  failuresLeft = 0;
  readonly billingIssueUserIds: string[] = [];
  readonly reportedFailures: unknown[] = [];

  notifySubscriptionEvent(): void {}

  async recordBillingIssue(userId: UserId): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error("transient database failure");
    }
    this.billingIssueUserIds.push(userId.value);
  }

  reportWebhookFailure(error: unknown): void {
    this.reportedFailures.push(error);
  }
}

describe("구독 웹훅의 일시 실패 재전송 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let receiver: RevenueCatWebhookReceiver;
  const notifier = new FlakyBillingIssueNotifier();

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(SubscriptionEventNotifierPort).useValue(notifier),
    });
    receiver = context.module.get(RevenueCatWebhookReceiver);
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

  function storeEvent(
    userId: string,
    builder: SubscriptionEventBuilder,
    eventId: string,
  ): RevenueCatWebhookPayload {
    return builder
      .withAppUserId(userId)
      .withOriginalTransactionId(CHAIN)
      .withTransactionId(CHAIN)
      .withEventId(eventId)
      .withPurchasedAtMs(at.getTime() - 24 * 60 * 60 * 1000)
      .withExpirationAtMs(expiresAt.getTime())
      .build();
  }

  it("트랜잭션 안의 일시 실패는 처리 원장까지 되돌리고 던져, 같은 웹훅을 다시 받으면 한 번만 반영한다", async () => {
    // Given
    const user = UserFixture.create({ id: createEntityId(), createdAt: instantFromDate(at) });
    await client.insert(userTable).values(user);
    await receiver.receive({
      body: storeEvent(user.id, SubscriptionEventBuilder.initialPurchase(), "purchase"),
    });
    const billingIssue = storeEvent(
      user.id,
      SubscriptionEventBuilder.billingIssue().withGracePeriodExpirationAtMs(graceEndsAt.getTime()),
      "billing-issue",
    );
    notifier.failuresLeft = 1;

    // When
    const firstAttempt = receiver.receive({ body: billingIssue });
    await expect(firstAttempt).rejects.toThrow("transient database failure");
    const afterFailure = {
      receipts: await client.query.subscriptionEventReceipt.findMany({
        where: { eventId: "billing-issue" },
      }),
      chain: await client.query.subscription.findFirst({
        columns: { gracePeriodEndsAt: true },
        where: { storeSubscriptionId: CHAIN },
      }),
    };
    await receiver.receive({ body: billingIssue });
    await receiver.receive({ body: billingIssue });

    // Then
    expect(afterFailure).toEqual({ receipts: [], chain: { gracePeriodEndsAt: null } });
    expect(
      await client.query.subscriptionEventReceipt.findMany({
        where: { eventId: "billing-issue" },
      }),
    ).toHaveLength(1);
    expect(
      await client.query.subscription.findFirst({
        columns: { gracePeriodEndsAt: true },
        where: { storeSubscriptionId: CHAIN },
      }),
    ).toEqual({ gracePeriodEndsAt: Temporal.Instant.fromEpochMilliseconds(graceEndsAt.getTime()) });
    expect(notifier.billingIssueUserIds).toEqual([user.id]);
    expect(notifier.reportedFailures).toEqual([]);
  });
});
