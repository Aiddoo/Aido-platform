import { currentUserSchema } from "@aido/api";
import { PLAN_CATALOG } from "@aido/api/vocabulary";
import { PREMIUM_FEATURE_KEYS } from "@aido/api/vocabulary";
import { eq } from "drizzle-orm";
import request from "supertest";

import { billingSubscriptionsConfig } from "#api/modules/billing/subscriptions/billing-subscriptions.config";
import { subscription, user } from "#api/platform/database/schema/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder } from "#test/builders/subscription-event.builder";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const FREE_AI_LIMIT = PLAN_CATALOG.AI_PARSE.free;

const webhookSecret = "me-entitlements-webhook-secret";
const AT = new Date("2027-01-04T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;
const FUTURE_EXPIRY = new Date("2027-02-04T12:00:00.000Z");

describe("/me 유효 프리미엄과 기능별 권한 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    context = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(billingSubscriptionsConfig.KEY).useValue(
          billingSubscriptionsConfig.parse({
            NODE_ENV: "test",
            REVENUECAT_WEBHOOK_SECRET: webhookSecret,
          }),
        ),
    });
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function me(accessToken: string) {
    const response = await request(context.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .expect(200);
    return currentUserSchema.parse(response.body.data);
  }

  async function updateUser(userId: string, values: Partial<typeof user.$inferInsert>) {
    await context.testDatabase.getClient().update(user).set(values).where(eq(user.id, userId));
  }

  it("FREE 사용자는 무료 한도와 오늘·이번 달 사용량, 다음 초기화 시각을 받는다", async () => {
    // Given
    const free = await context.helpers.createVerifiedUser("me-free@test.com", "Test1234!");

    // When
    const body = await me(free.accessToken);

    // Then
    expect(body.subscriptionStatus).toBe("FREE");
    expect(body.isPremium).toBe(false);
    expect(body.entitlements?.AI_PARSE).toEqual({
      allowed: true,
      limit: FREE_AI_LIMIT,
      used: 0,
      resetsAt: "2027-01-31T15:00:00.000Z",
    });
    expect(body.entitlements?.CHEER).toEqual({
      allowed: true,
      limit: 3,
      used: 0,
      resetsAt: "2027-01-04T15:00:00.000Z",
    });
    expect(body.entitlements?.TODO_CATEGORY).toEqual({ allowed: true, limit: 3 });
    expect(body.entitlements?.AI_REPORT).toEqual({ allowed: false, limit: null });
    expect(body.entitlements?.APP_ICON).toEqual({ allowed: false, limit: null });
  });

  it("SANDBOX 구매 웹훅을 받은 사용자도 프리미엄이고 결제 환경을 구독 행에 남긴다", async () => {
    // Given
    const premium = await context.helpers.createVerifiedUser("me-premium@test.com", "Test1234!");
    const purchase = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(premium.userId)
      .withOriginalTransactionId("me-sandbox-transaction")
      .withEventId("me-sandbox-purchase")
      .withPurchasedAtMs(AT.getTime() - HOUR_MS)
      .withExpirationAtMs(FUTURE_EXPIRY.getTime())
      .withEnvironment("SANDBOX")
      .build();
    await request(context.app.getHttpServer())
      .post("/v1/webhooks/revenuecat")
      .set("Authorization", `Bearer ${webhookSecret}`)
      .send(purchase)
      .expect(200);

    // When
    const body = await me(premium.accessToken);

    // Then
    expect(body.subscriptionStatus).toBe("ACTIVE");
    expect(body.isPremium).toBe(true);
    expect(body.entitlements?.AI_PARSE).toMatchObject({ allowed: true, limit: null });
    expect(body.entitlements?.TODO_CATEGORY).toEqual({ allowed: true, limit: 30 });
    expect(body.entitlements?.AI_REPORT).toEqual({ allowed: true, limit: null });
    const [stored] = await context.testDatabase
      .getClient()
      .select({ environment: subscription.environment })
      .from(subscription)
      .where(eq(subscription.userId, premium.userId));
    expect(stored?.environment).toBe("SANDBOX");
  });

  it("만료가 지났는데 정리 전이라 ACTIVE로 남은 사용자는 subscriptionStatus는 그대로지만 isPremium·권한은 무료다", async () => {
    // Given
    const lapsed = await context.helpers.createVerifiedUser("me-lapsed@test.com", "Test1234!");
    await updateUser(lapsed.userId, {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: instantFromDate(AT).subtract({ milliseconds: HOUR_MS }),
    });

    // When
    const body = await me(lapsed.accessToken);

    // Then
    expect(body.subscriptionStatus).toBe("ACTIVE");
    expect(body.isPremium).toBe(false);
    expect(body.entitlements?.AI_PARSE).toMatchObject({ allowed: true, limit: FREE_AI_LIMIT });
    expect(body.entitlements?.CUSTOM_REMINDER_TIME).toEqual({ allowed: false, limit: null });
  });

  it("ADMIN은 isPremium이 아니어도 모든 기능을 프리미엄 표시 한도로 쓸 수 있다", async () => {
    // Given
    const admin = await context.helpers.createVerifiedUser("me-admin@test.com", "Test1234!");
    await updateUser(admin.userId, { role: "ADMIN" });

    // When
    const body = await me(admin.accessToken);

    // Then
    expect(body.role).toBe("ADMIN");
    expect(body.isPremium).toBe(false);
    for (const feature of PREMIUM_FEATURE_KEYS) {
      const definition = PLAN_CATALOG[feature];
      const limit = definition.kind === "flag" ? null : definition.premium;
      expect(body.entitlements?.[feature], feature).toMatchObject({ allowed: true, limit });
    }
    expect(body.entitlements?.TODO_CATEGORY.limit).toBe(PLAN_CATALOG.TODO_CATEGORY.premium);
  });
});
