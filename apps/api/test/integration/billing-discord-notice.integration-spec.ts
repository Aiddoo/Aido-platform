/**
 * RevenueCat 웹훅 1건이 결제 채널 관리자 알림(사용자 블록 + 결제 블록)과 Discord embed가 되기까지
 * 실제 PostgreSQL로 확인한다. Discord로는 보내지 않는다(ADMIN_NOTIFIER는 기록용 Fake).
 */
import type { RevenueCatWebhookPayload } from "@aido/api";

import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { AdminNotifierPort } from "#api/modules/operations/admin-notices/application/ports/admin-notifier.port";
import type { AdminNotice } from "#api/modules/operations/admin-notices/application/read-models/admin-notice.read-model";
import { DispatchDailySignupSummaryUseCase } from "#api/modules/operations/admin-notices/application/use-cases/dispatch-daily-signup-summary.use-case";
import { SendAdminNotificationUseCase } from "#api/modules/operations/admin-notices/application/use-cases/send-admin-notification.use-case";
import { renderDiscordEmbed } from "#api/modules/operations/admin-notices/infrastructure/adapters/discord-embed.mapper";
import { AdminNotificationProcessor } from "#api/modules/operations/admin-notices/infrastructure/jobs/admin-notification.processor";
import { ADMIN_NOTIFICATION_QUEUE } from "#api/modules/operations/admin-notices/infrastructure/jobs/admin-notification.queue";
import { DrizzleAdminNoticeUserReader } from "#api/modules/operations/admin-notices/infrastructure/persistence/drizzle-admin-notice-user.reader";
import { createEntityId } from "#api/platform/database/entity-id";
import { account, user as userTable, userProfile } from "#api/platform/database/schema/index";
import { JobQueuePort } from "#api/shared/application/ports/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder } from "#test/builders/index";
import type { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { AccountFixture, UserFixture } from "#test/fixtures/user.fixture";
import type { FakeAdminNotifier } from "#test/mocks/fake-admin-notifier";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

/** 2026-11-10 10:00 KST */
const AT = new Date("2026-11-10T01:00:00.000Z");
const JOINED_AT = new Date("2026-10-01T03:00:00.000Z");
const EXPIRES_AT = new Date("2027-11-10T01:00:00.000Z");
const PROJECT_ID = "proj_discord_notice";

describe("결제 웹훅 → Discord 결제 알림 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let receiver: RevenueCatWebhookReceiver;
  let jobQueue: InMemoryJobQueue;
  let notifier: FakeAdminNotifier;
  let processor: AdminNotificationProcessor;
  let userId: string;

  beforeAll(async () => {
    process.env.REVENUECAT_PROJECT_ID = PROJECT_ID;
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
    receiver = context.module.get(RevenueCatWebhookReceiver);
    jobQueue = context.module.get<typeof JobQueuePort, InMemoryJobQueue>(JobQueuePort);
    notifier = context.module.get(AdminNotifierPort);
    // E2E 앱은 백그라운드 작업자를 끈다. 같은 조립의 유스케이스로 작업자를 만들어 큐 payload 검증부터 탄다
    processor = new AdminNotificationProcessor(
      jobQueue,
      context.module.get(SendAdminNotificationUseCase),
      context.module.get(DispatchDailySignupSummaryUseCase),
    );
    await processor.onModuleInit();
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const owner = UserFixture.create({
      id: createEntityId(),
      email: "matthew@example.com",
      userTag: "MATT2025",
      createdAt: JOINED_AT,
      updatedAt: JOINED_AT,
    });
    await client.insert(userTable).values(owner);
    await client.insert(userProfile).values({ userId: owner.id, name: "매튜" });
    // 가입 방식은 처음 만든 계정이다. 나중에 연결한 Google 계정이 아니다
    await client.insert(account).values([
      AccountFixture.create({
        userId: owner.id,
        provider: "APPLE",
        createdAt: instantFromDate(JOINED_AT),
      }),
      AccountFixture.create({
        userId: owner.id,
        provider: "GOOGLE",
        createdAt: instantFromDate(AT),
      }),
    ]);
    userId = owner.id;
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    delete process.env.REVENUECAT_PROJECT_ID;
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  function withCountry(payload: RevenueCatWebhookPayload, countryCode: string) {
    return { ...payload, event: { ...payload.event, country_code: countryCode } };
  }

  /** 커밋 뒤 기다리지 않고 넘긴 알림이 큐에 들어올 때까지 기다렸다가 작업자로 처리한다. */
  async function deliverPaymentNotices(count: number): Promise<AdminNotice[]> {
    await vi.waitFor(() => expect(jobQueue.jobsIn(ADMIN_NOTIFICATION_QUEUE)).toHaveLength(count), {
      timeout: 5_000,
    });
    await jobQueue.drain(ADMIN_NOTIFICATION_QUEUE);
    return notifier.getSent("payment").map((sent) => sent.notice);
  }

  it("운영 연간 구매 1건은 저장된 사용자 블록과 웹훅 금액·국가·만료로 결제 알림이 된다", async () => {
    // Given
    const purchase = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(userId)
      .withProductId("com.aido.pro.yearly")
      .withEventId("evt-discord-purchase")
      .withTransactionId("2000000812345678")
      .withOriginalTransactionId("2000000812345678")
      .withPeriodType("NORMAL")
      .withPurchasedAtMs(AT.getTime() - 60_000)
      .withExpirationAtMs(EXPIRES_AT.getTime())
      .withPrice(27.99, "KRW", 39_000)
      .build();

    // When
    await receiver.receive({ body: withCountry(purchase, "KR") });
    const [notice] = await deliverPaymentNotices(1);

    // Then
    expect(notice).toEqual({
      type: "subscription_event",
      user: {
        userId,
        email: "matthew@example.com",
        nickname: "매튜",
        userTag: "MATT2025",
        joinedAt: JOINED_AT.toISOString(),
        signupMethod: "APPLE",
      },
      subscription: {
        event: "purchased",
        environment: "PRODUCTION",
        store: "APP_STORE",
        productId: "com.aido.pro.yearly",
        planType: "ANNUAL",
        periodKind: "NORMAL",
        price: { amount: 39_000, currency: "KRW", usd: 27.99 },
        purchasedAt: new Date(AT.getTime() - 60_000).toISOString(),
        expiresAt: EXPIRES_AT.toISOString(),
        countryCode: "KR",
        isFirstPurchase: true,
        premium: {
          source: "STORE",
          periodEndsAt: EXPIRES_AT.toISOString(),
          bankedDays: 0,
          isTrial: false,
        },
        storeSubscriptionId: "2000000812345678",
        customerUrl: `https://app.revenuecat.com/projects/${PROJECT_ID}/customers/${userId}`,
      },
    });

    if (notice == null) {
      throw new Error("결제 알림이 없습니다");
    }
    const embed = renderDiscordEmbed(notice, AT.toISOString());
    expect(embed.title).toBe("[운영] 🎉 새 구독");
    expect(embed.fields.slice(0, 9).map((field) => [field.name, field.value])).toEqual([
      ["닉네임", "매튜"],
      ["태그", "#MATT2025"],
      ["가입 방식", "Apple"],
      ["가입일", "2026-10-01 (D+40)"],
      ["이메일", "matthew@example.com"],
      ["사용자 ID", `\`${userId}\``],
      ["국가", "🇰🇷 대한민국 (KR)"],
      ["프리미엄", "스토어 구독"],
      [
        "RevenueCat",
        `[고객 화면](https://app.revenuecat.com/projects/${PROJECT_ID}/customers/${userId})`,
      ],
    ]);
    expect(embed.fields).toContainEqual({
      name: "금액",
      value: "₩39,000 · US$27.99",
      inline: true,
    });
  });

  it("결제 실패로 만료되면 위험 색과 결제 실패 사유를 보여 준다", async () => {
    // Given
    const transactionId = "2000000899990000";
    const purchase = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(userId)
      .withProductId("com.aido.pro.monthly")
      .withEventId("evt-discord-monthly")
      .withTransactionId(transactionId)
      .withOriginalTransactionId(transactionId)
      .withPurchasedAtMs(AT.getTime() - 31 * 24 * 60 * 60 * 1_000)
      .withExpirationAtMs(AT.getTime() - 60_000)
      .withPrice(2.99, "KRW", 3_900)
      .build();
    const expiration = SubscriptionEventBuilder.expiration()
      .withAppUserId(userId)
      .withProductId("com.aido.pro.monthly")
      .withEventId("evt-discord-expired")
      .withTransactionId(transactionId)
      .withOriginalTransactionId(transactionId)
      .withExpirationAtMs(AT.getTime() - 60_000)
      .withExpirationReason("BILLING_ERROR")
      .build();
    await receiver.receive({ body: purchase });

    // When
    await receiver.receive({ body: expiration });
    const notices = await deliverPaymentNotices(2);

    // Then
    const expired = notices.find(
      (notice) => notice.type === "subscription_event" && notice.subscription.event === "expired",
    );
    if (expired == null) {
      throw new Error("만료 알림이 없습니다");
    }
    const embed = renderDiscordEmbed(expired, AT.toISOString());
    expect(embed.title).toBe("[운영] ⌛ 구독 만료");
    expect(embed.color).toBe(0xed4245);
    expect(embed.fields).toContainEqual({
      name: "사유",
      value: "결제 실패 (BILLING_ERROR)",
      inline: false,
    });
    expect(embed.fields).toContainEqual({ name: "요금제", value: "월간", inline: true });
    expect(embed.fields).toContainEqual({ name: "프리미엄", value: "무료", inline: true });
  });
});

describe("DrizzleAdminNoticeUserReader (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let reader: DrizzleAdminNoticeUserReader;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
    const { txHost } = createDatabaseTransactionFixture(client);
    reader = new DrizzleAdminNoticeUserReader(txHost);
  });
  afterAll(async () => database?.stop());
  beforeEach(async () => {
    await database.cleanup();
    UserFixture.reset();
    AccountFixture.reset();
  });

  it("탈퇴한 사용자는 찾지 않는다", async () => {
    // Given
    const deleted = UserFixture.create({ deletedAt: AT });
    await client.insert(userTable).values(deleted);

    // When / Then
    await expect(reader.findById(deleted.id)).resolves.toBeNull();
  });

  it("프로필·계정이 없는 사용자는 닉네임·가입 방식을 비운다", async () => {
    // Given
    const bare = UserFixture.create({ userTag: "BARE0001", createdAt: JOINED_AT });
    await client.insert(userTable).values(bare);

    // When
    const found = await reader.findById(bare.id);

    // Then
    expect(found).toEqual({
      userId: bare.id,
      email: bare.email,
      userTag: "BARE0001",
      joinedAt: JOINED_AT.toISOString(),
    });
  });
});
