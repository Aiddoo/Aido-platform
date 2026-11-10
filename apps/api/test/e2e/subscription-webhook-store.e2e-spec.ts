import { currentUserSchema } from "@aido/api";
import { Logger } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import request from "supertest";
import { z } from "zod";

import { billingSubscriptionsConfig } from "#api/modules/billing/subscriptions/billing-subscriptions.config";
import { appConfig } from "#api/platform/config/app.config";
import { subscription, subscriptionEventReceipt } from "#api/platform/database/schema/index";
import { OPERATIONAL_ALERT } from "#api/shared/application/ports/operational-alert.port";
import { SubscriptionEventBuilder } from "#test/builders/subscription-event.builder";
import { RecordingOperationalAlert } from "#test/mocks/recording-operational-alert";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const webhookSecret = "subscription-store-e2e-webhook-secret";
const at = new Date("2027-01-04T12:00:00.000Z");
const expiresAt = new Date("2027-02-04T12:00:00.000Z");
const loggedEventSchema = z.object({ event: z.string() });

describe("RevenueCat 웹훅의 스토어·환경별 처리 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;
  const alert = new RecordingOperationalAlert();

  beforeAll(async () => {
    context = await createE2eApp({
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(OPERATIONAL_ALERT)
          .useValue(alert)
          .overrideProvider(billingSubscriptionsConfig.KEY)
          .useValue({
            revenuecat: { webhookSecret, projectId: undefined, apiV2SecretKey: undefined },
          }),
      additionalResetters: [() => alert.alerts.splice(0)],
    });
  });

  // 배포 환경은 시작할 때 한 번 읽으므로 앱이 받은 설정 값을 테스트마다 바꾼다
  function deployTo(appEnv: ConfigType<typeof appConfig>["appEnv"]): void {
    context.module.get<ConfigType<typeof appConfig>>(appConfig.KEY).appEnv = appEnv;
  }

  beforeEach(async () => {
    deployTo("production");
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  function webhook(body: object) {
    return request(context.app.getHttpServer())
      .post("/v1/webhooks/revenuecat")
      .set("Authorization", `Bearer ${webhookSecret}`)
      .send(body);
  }

  function purchase(appUserId: string, eventId: string) {
    return SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(appUserId)
      .withEventId(eventId)
      .withOriginalTransactionId(`${eventId}-chain`)
      .withPurchasedAtMs(at.getTime())
      .withExpirationAtMs(expiresAt.getTime());
  }

  async function currentUser(accessToken: string) {
    const response = await request(context.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return currentUserSchema.parse(response.body.data);
  }

  async function storedRows() {
    const database = context.testDatabase.getClient();
    return {
      subscriptions: await database.select().from(subscription),
      receipts: await database.select().from(subscriptionEventReceipt),
    };
  }

  function webhookLogEvents(): string[] {
    return vi
      .mocked(Logger.prototype.log)
      .mock.calls.flatMap(([message]) => {
        const logged = loggedEventSchema.safeParse(message);
        return logged.success ? [logged.data.event] : [];
      })
      .filter((event) => event.startsWith("billing.subscription.webhook."));
  }

  it("운영은 Test Store 구매를 200으로 받고 구독·원장·프리미엄을 바꾸지 않으며 경보 없이 로그 한 건만 남긴다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("test-store@example.com", "Test1234!");

    // When
    const response = await webhook(
      purchase(user.userId, "test-store-purchase")
        .withStore("TEST_STORE")
        .withEnvironment("SANDBOX")
        .build(),
    ).expect(200);

    // Then
    expect(response.body.data).toEqual({ received: true });
    expect(await storedRows()).toEqual({ subscriptions: [], receipts: [] });
    expect(await currentUser(user.accessToken)).toMatchObject({
      subscriptionStatus: "FREE",
      premiumSource: null,
    });
    expect(alert.alerts).toEqual([]);
    expect(webhookLogEvents()).toEqual(["billing.subscription.webhook.skipped"]);
  });

  it.each([
    {
      name: "App Store SANDBOX(App Review)",
      store: "APP_STORE",
      environment: "SANDBOX",
      productId: "com.aido.pro.monthly",
      planType: "MONTHLY",
    },
    {
      name: "Play Store PRODUCTION 기본 요금제",
      store: "PLAY_STORE",
      environment: "PRODUCTION",
      productId: "com.aido.pro.yearly:yearly-base",
      planType: "ANNUAL",
    },
  ] as const)(
    "운영은 $name 구매를 반영하고 /me에 요금제를 보여 준다",
    async ({ store, environment, productId, planType }) => {
      // Given
      const user = await context.helpers.createVerifiedUser("store@example.com", "Test1234!");

      // When
      await webhook(
        purchase(user.userId, `${store}-purchase`)
          .withStore(store)
          .withEnvironment(environment)
          .withProductId(productId)
          .build(),
      ).expect(200);

      // Then
      expect(await currentUser(user.accessToken)).toMatchObject({
        subscriptionStatus: "ACTIVE",
        premiumSource: "STORE",
        premiumPlanType: planType,
      });
      expect((await storedRows()).subscriptions).toMatchObject([
        { userId: user.userId, environment },
      ]);
      expect(alert.alerts).toEqual([]);
    },
  );

  it("운영 PRODUCTION 구매의 사용자를 찾지 못하면 200으로 받고 경보를 한 번 올린다", async () => {
    // Given
    const body = purchase("unknown-production-user", "unknown-user-purchase").build();

    // When
    await webhook(body).expect(200);

    // Then
    expect(alert.alerts).toMatchObject([
      {
        key: "billing.subscription.webhook.processing-failed",
        severity: "error",
        tags: { storeEnvironment: "PRODUCTION" },
      },
    ]);
    expect(await storedRows()).toEqual({ subscriptions: [], receipts: [] });
  });

  it("대시보드 TEST 이벤트는 우리 사용자가 아니어도 200으로 받고 원장·경보 없이 로그 한 건만 남긴다", async () => {
    // Given
    const body = SubscriptionEventBuilder.test()
      .withAppUserId("dashboard-test-user")
      .withEventId("dashboard-test-event")
      .build();

    // When
    const response = await webhook(body).expect(200);

    // Then
    expect(response.body.data).toEqual({ received: true });
    expect(await storedRows()).toEqual({ subscriptions: [], receipts: [] });
    expect(alert.alerts).toEqual([]);
    expect(webhookLogEvents()).toEqual(["billing.subscription.webhook.ignored"]);
  });

  it("같은 이벤트 ID를 다시 받으면 한 번만 반영한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("duplicate@example.com", "Test1234!");
    const body = purchase(user.userId, "duplicate-purchase").build();
    await webhook(body).expect(200);

    // When
    await webhook(body).expect(200);

    // Then
    const rows = await storedRows();
    expect(rows.subscriptions).toHaveLength(1);
    expect(rows.receipts).toHaveLength(1);
    expect(alert.alerts).toEqual([]);
  });

  it("운영이 아닌 서버는 Test Store 구매를 지금처럼 반영한다", async () => {
    // Given
    deployTo("development");
    const user = await context.helpers.createVerifiedUser("local@example.com", "Test1234!");

    // When
    await webhook(
      purchase(user.userId, "local-test-store-purchase")
        .withStore("TEST_STORE")
        .withEnvironment("SANDBOX")
        .build(),
    ).expect(200);

    // Then
    expect(await currentUser(user.accessToken)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      premiumSource: "STORE",
    });
    const rows = await storedRows();
    expect(rows.subscriptions).toMatchObject([{ userId: user.userId, environment: "SANDBOX" }]);
    expect(rows.receipts).toHaveLength(1);
  });
});
