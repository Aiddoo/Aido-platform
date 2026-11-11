import type { RevenueCatWebhookPayload } from "@aido/api";

import { PremiumAccessReaderPort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { StoreSubscriptionStatusReaderPort } from "#api/modules/billing/subscriptions/application/ports/store-subscription-status.reader.port";
import { SubscriptionEventNotifierPort } from "#api/modules/billing/subscriptions/application/ports/subscription-event-notifier.port";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { STORE_SUBSCRIPTION_RECONCILE_QUEUE } from "#api/modules/billing/subscriptions/infrastructure/jobs/store-subscription-reconcile.queue";
import { createEntityId } from "#api/platform/database/entity-id";
import { user as userTable } from "#api/platform/database/schema/index";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { StubStoreSubscriptionStatusReader } from "#test/doubles/billing/stub-store-subscription-status.reader";
import type { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

// 대조는 RevenueCat 읽기 설정이 있을 때만 켜진다. 설정은 앱 모듈을 불러올 때 읽으므로 import보다 먼저 넣고,
// 실제 호출은 Port Stub이 막는다
vi.hoisted(() => {
  process.env.REVENUECAT_API_V2_SECRET_KEY = "sk_integration";
  process.env.REVENUECAT_PROJECT_ID = "proj_integration";
});

const at = new Date("2027-01-04T12:00:10.000Z");
const startedAt = new Date("2026-12-04T12:00:00.000Z");
const expiresAt = new Date("2027-02-04T12:00:00.000Z");
const renewedExpiresAt = new Date("2027-03-04T12:00:00.000Z");
const CHAIN = "reconcile-chain";

const subscriptionEventNotifier: SubscriptionEventNotifierPort = {
  notifySubscriptionEvent: () => {},
  recordBillingIssue: async () => {},
  reportWebhookFailure: () => {},
};

describe("구독 웹훅 뒤 스토어 상태 대조 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let webhook: RevenueCatWebhookReceiver;
  let jobs: InMemoryJobQueue;
  let premiumAccess: PremiumAccessReaderPort;
  const statusReader = new StubStoreSubscriptionStatusReader();

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(SubscriptionEventNotifierPort)
          .useValue(subscriptionEventNotifier)
          .overrideProvider(StoreSubscriptionStatusReaderPort)
          .useValue(statusReader),
    });
    webhook = context.module.get(RevenueCatWebhookReceiver);
    jobs = context.module.get(JobQueuePort);
    premiumAccess = context.module.get(PremiumAccessReaderPort);
  });

  beforeEach(async () => {
    await context.reset();
    statusReader.states.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    delete process.env.REVENUECAT_API_V2_SECRET_KEY;
    delete process.env.REVENUECAT_PROJECT_ID;
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
      .withPurchasedAtMs(startedAt.getTime())
      .withExpirationAtMs(expiresAt.getTime())
      .build();
  }

  it("같은 1분 안의 웹훅은 대조 잡 하나로 묶이고, 대조가 놓친 갱신·해지 철회를 스토어 상태로 맞춘다", async () => {
    // Given
    const user = UserFixture.create({
      id: createEntityId(),
      createdAt: instantFromDate(startedAt),
    });
    await client.insert(userTable).values(user);
    await webhook.receive({
      body: storeEvent(user.id, SubscriptionEventBuilder.initialPurchase(), "purchase"),
    });
    await webhook.receive({
      body: storeEvent(user.id, SubscriptionEventBuilder.cancellation(), "cancel"),
    });
    statusReader.states.set(CHAIN, {
      storeSubscriptionId: CHAIN,
      productId: "premium_monthly",
      periodEndsAt: Temporal.Instant.fromEpochMilliseconds(renewedExpiresAt.getTime()),
      willRenew: true,
      isTrial: false,
      givesAccess: true,
    });
    const reconcileJobs = [...jobs.jobsIn(STORE_SUBSCRIPTION_RECONCILE_QUEUE)];

    // When
    await jobs.drain(STORE_SUBSCRIPTION_RECONCILE_QUEUE);
    const afterFirstRun = await client.query.subscription.findFirst({
      columns: { status: true, expiresAt: true, updatedAt: true },
      where: { revenueCatId: CHAIN },
    });
    await jobs.enqueue(STORE_SUBSCRIPTION_RECONCILE_QUEUE, {
      name: "reconcile-store-subscriptions",
      data: { userId: user.id },
    });
    await jobs.drain(STORE_SUBSCRIPTION_RECONCILE_QUEUE);

    // Then
    expect(reconcileJobs).toHaveLength(1);
    expect(reconcileJobs[0]?.payload).toEqual({
      name: "reconcile-store-subscriptions",
      data: { userId: user.id },
    });
    expect(afterFirstRun).toMatchObject({
      status: "ACTIVE",
      expiresAt: Temporal.Instant.fromEpochMilliseconds(renewedExpiresAt.getTime()),
    });
    expect(
      await client.query.subscription.findFirst({
        columns: { status: true, expiresAt: true, updatedAt: true },
        where: { revenueCatId: CHAIN },
      }),
    ).toEqual(afterFirstRun);
    expect(await premiumAccess.getPremiumAccess(UserId.reconstitute(user.id))).toMatchObject({
      source: "STORE",
      periodEndsAt: renewedExpiresAt,
      willRenew: true,
    });
  });
});
