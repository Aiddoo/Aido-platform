import type { RevenueCatWebhookPayload } from "@aido/api";

import { STORE_SUBSCRIPTION_STATUS_READER } from "#api/modules/billing/application/ports/subscriptions/store-subscription-status.reader.port";
import {
  SUBSCRIPTION_EVENT_NOTIFIER,
  type SubscriptionEventNotifierPort,
} from "#api/modules/billing/application/ports/subscriptions/subscription-event-notifier.port";
import { STORE_SUBSCRIPTION_RECONCILE_QUEUE } from "#api/modules/billing/billing-subscriptions-jobs.public";
import {
  PREMIUM_ACCESS_READER,
  type PremiumAccessReaderPort,
} from "#api/modules/billing/billing-subscriptions.public";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/infrastructure/revenuecat/revenuecat-webhook.receiver";
import { createEntityId } from "#api/platform/database/entity-id";
import { user as userTable } from "#api/platform/database/schema/index";
import { JOB_RUNTIME } from "#api/shared/application/ports/index";
import { SubscriptionEventBuilder } from "#test/builders/index";
import { UserFixture } from "#test/fixtures/index";
import type { FakeJobRuntime } from "#test/mocks/fake-job-runtime";
import { StubStoreSubscriptionStatusReader } from "#test/mocks/ports/subscription.stub";
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
  notifyBillingIssue: () => {},
  reportWebhookFailure: () => {},
};

describe("구독 웹훅 뒤 스토어 상태 대조 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let webhook: RevenueCatWebhookReceiver;
  let jobs: FakeJobRuntime;
  let premiumAccess: PremiumAccessReaderPort;
  const statusReader = new StubStoreSubscriptionStatusReader();

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(SUBSCRIPTION_EVENT_NOTIFIER)
          .useValue(subscriptionEventNotifier)
          .overrideProvider(STORE_SUBSCRIPTION_STATUS_READER)
          .useValue(statusReader),
    });
    webhook = context.module.get(RevenueCatWebhookReceiver);
    jobs = context.module.get(JOB_RUNTIME);
    premiumAccess = context.module.get(PREMIUM_ACCESS_READER);
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
    const user = UserFixture.create({ id: createEntityId(), createdAt: startedAt });
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
      periodEndsAt: renewedExpiresAt,
      willRenew: true,
      isTrial: false,
      givesAccess: true,
    });
    const reconcileJobs = jobs.enqueueCalls.filter(
      (call) => call.queue === STORE_SUBSCRIPTION_RECONCILE_QUEUE,
    );

    // When
    for (const job of reconcileJobs) {
      await jobs.run(STORE_SUBSCRIPTION_RECONCILE_QUEUE, job.data);
    }
    const afterFirstRun = await client.query.subscription.findFirst({
      columns: { status: true, expiresAt: true, updatedAt: true },
      where: { revenueCatId: CHAIN },
    });
    await jobs.run(STORE_SUBSCRIPTION_RECONCILE_QUEUE, reconcileJobs[0]?.data ?? {});

    // Then
    expect(reconcileJobs).toHaveLength(1);
    expect(reconcileJobs[0]?.data).toEqual({
      name: "reconcile-store-subscriptions",
      data: { userId: user.id },
    });
    expect(afterFirstRun).toMatchObject({ status: "ACTIVE", expiresAt: renewedExpiresAt });
    expect(
      await client.query.subscription.findFirst({
        columns: { status: true, expiresAt: true, updatedAt: true },
        where: { revenueCatId: CHAIN },
      }),
    ).toEqual(afterFirstRun);
    expect(await premiumAccess.getPremiumAccess(user.id)).toMatchObject({
      source: "STORE",
      periodEndsAt: renewedExpiresAt,
      willRenew: true,
    });
  });
});
