import { currentUserSchema, type RevenueCatWebhookPayload } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import { SubscriptionWebhookLockPort } from "#api/modules/billing/subscriptions/application/ports/subscription-webhook-lock.port";
import { billingSubscriptionsConfig } from "#api/modules/billing/subscriptions/billing-subscriptions.config";
import { PremiumGranterPort } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { AuthCachePort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import { subscription, subscriptionEventReceipt } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder } from "#test/builders/subscription-event.builder";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const webhookSecret = "subscription-e2e-webhook-secret";
const at = new Date("2027-01-04T12:00:00.000Z");
const pastExpiry = new Date("2027-01-03T12:00:00.000Z");
const futureExpiry = new Date("2027-02-03T12:00:00.000Z");

describe("구독 Webhook HTTP 계약과 권한 캐시 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    // 웹훅 비밀은 시작할 때 한 번 읽으므로 앱을 만들 때 넣는다
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
    vi.setSystemTime(at);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  function webhook(body: object, authorization = `Bearer ${webhookSecret}`) {
    return request(context.app.getHttpServer())
      .post("/v1/webhooks/revenuecat")
      .set("Authorization", authorization)
      .send(body);
  }

  function purchase(userId: string, transactionId: string, expiresAt = futureExpiry) {
    return SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(userId)
      .withOriginalTransactionId(transactionId)
      .withEventId(`${transactionId}-purchase`)
      .withPurchasedAtMs(pastExpiry.getTime() - 30 * 24 * 60 * 60 * 1000)
      .withExpirationAtMs(expiresAt.getTime())
      .build();
  }

  function currentUser(accessToken: string) {
    return request(context.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
  }

  function premiumPreference(accessToken: string) {
    return request(context.app.getHttpServer())
      .patch("/v1/auth/preference")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ morningReminderHour: 7 });
  }

  async function storedUser(userId: string) {
    return context.testDatabase.getClient().query.user.findFirst({ where: { id: userId } });
  }

  it("구매 커밋 후 같은 JWT로 유료 프로필과 설정 권한을 즉시 조회한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "billing-purchase@example.com",
      "Test1234!",
    );
    expect((await currentUser(user.accessToken).expect(200)).body.data.subscriptionStatus).toBe(
      "FREE",
    );
    await premiumPreference(user.accessToken).expect(403);

    // When
    const response = await webhook(purchase(user.userId, "billing-purchase")).expect(200);
    const profile = await currentUser(user.accessToken).expect(200);
    await premiumPreference(user.accessToken).expect(200);

    // Then
    expect(response.body).toMatchObject({ success: true, data: { received: true } });
    expect(profile.body.data.subscriptionStatus).toBe("ACTIVE");
    expect(await storedUser(user.userId)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: instantFromDate(futureExpiry),
    });
    expect(
      await context.testDatabase.getClient().select().from(subscriptionEventReceipt),
    ).toHaveLength(1);
  });

  it("동일 만료 이벤트 재전송과 과거 기간의 새 만료 이벤트가 갱신된 권한을 해제하지 않는다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "billing-replay@example.com",
      "Test1234!",
    );
    const transactionId = "billing-replay";
    await webhook(purchase(user.userId, transactionId, pastExpiry)).expect(200);
    const expiration = SubscriptionEventBuilder.expiration()
      .withAppUserId(user.userId)
      .withOriginalTransactionId(transactionId)
      .withEventId("billing-replay-expiration")
      .withExpirationAtMs(pastExpiry.getTime())
      .build();
    await webhook(expiration).expect(200);
    const renewal = SubscriptionEventBuilder.renewal()
      .withAppUserId(user.userId)
      .withOriginalTransactionId(transactionId)
      .withEventId("billing-replay-renewal")
      .withExpirationAtMs(futureExpiry.getTime())
      .build();
    await webhook(renewal).expect(200);
    await currentUser(user.accessToken).expect(200);
    await premiumPreference(user.accessToken).expect(200);

    // When
    await webhook(expiration).expect(200);
    await webhook({
      ...expiration,
      event: { ...expiration.event, id: "billing-replay-late-expiration" },
    }).expect(200);

    // Then
    expect((await currentUser(user.accessToken).expect(200)).body.data.subscriptionStatus).toBe(
      "ACTIVE",
    );
    await premiumPreference(user.accessToken).expect(200);
    expect(await storedUser(user.userId)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: instantFromDate(futureExpiry),
    });
    expect(
      await context.testDatabase.getClient().select().from(subscriptionEventReceipt),
    ).toHaveLength(4);
  });

  it.each(["EXPIRATION", "CANCELLATION"] as const)(
    "과거 체인의 %s 이후에도 다른 유효한 체인의 접근 권한을 유지한다",
    async (type) => {
      // Given
      const user = await context.helpers.createVerifiedUser(
        "billing-other-chain@example.com",
        "Test1234!",
      );
      await webhook(purchase(user.userId, "billing-old-chain", pastExpiry)).expect(200);
      await webhook(purchase(user.userId, "billing-current-chain")).expect(200);
      await currentUser(user.accessToken).expect(200);
      await premiumPreference(user.accessToken).expect(200);
      const builder =
        type === "EXPIRATION"
          ? SubscriptionEventBuilder.expiration()
          : SubscriptionEventBuilder.refundCancellation();
      const payload = builder
        .withAppUserId(user.userId)
        .withOriginalTransactionId("billing-old-chain")
        .withEventId(`billing-other-chain-${type}`)
        .withExpirationAtMs(pastExpiry.getTime())
        .build();

      // When
      await webhook(payload).expect(200);

      // Then
      expect((await currentUser(user.accessToken).expect(200)).body.data.subscriptionStatus).toBe(
        "ACTIVE",
      );
      await premiumPreference(user.accessToken).expect(200);
      expect(await storedUser(user.userId)).toMatchObject({
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: instantFromDate(futureExpiry),
      });
      expect(
        await context.testDatabase.getClient().select().from(subscriptionEventReceipt),
      ).toHaveLength(3);
    },
  );

  it("정상 취소는 만료일까지 권한을 유지하고 환불은 즉시 해제한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser(
      "billing-refund@example.com",
      "Test1234!",
    );
    const transactionId = "billing-refund";
    await webhook(purchase(user.userId, transactionId)).expect(200);
    const cancellation = SubscriptionEventBuilder.cancellation()
      .withAppUserId(user.userId)
      .withOriginalTransactionId(transactionId)
      .withEventId("billing-refund-cancel")
      .withExpirationAtMs(futureExpiry.getTime())
      .build();
    await webhook(cancellation).expect(200);
    expect((await currentUser(user.accessToken).expect(200)).body.data.subscriptionStatus).toBe(
      "ACTIVE",
    );
    await premiumPreference(user.accessToken).expect(200);

    // When
    const refund: RevenueCatWebhookPayload = {
      ...cancellation,
      event: {
        ...cancellation.event,
        id: "billing-refund-confirmed",
        cancel_reason: "CUSTOMER_SUPPORT",
      },
    };
    await webhook(refund).expect(200);

    // Then
    expect((await currentUser(user.accessToken).expect(200)).body.data.subscriptionStatus).toBe(
      "FREE",
    );
    await premiumPreference(user.accessToken).expect(403);
    expect(await storedUser(user.userId)).toMatchObject({
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
    });
  });

  it("실제 Webhook 잠금 경합은 429로 반환하고 잠금 해제 후 같은 이벤트를 처리한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("billing-lock@example.com", "Test1234!");
    const lock = context.module.get(SubscriptionWebhookLockPort);
    const release = await lock.acquire(user.userId);
    if (release === null) {
      throw new Error("테스트 Webhook 잠금 획득 실패");
    }
    const payload = purchase(user.userId, "billing-lock");

    // When
    try {
      const rejected = await webhook(payload).expect(429);
      expect(rejected.body.error.code).toBe(ErrorCode.SUBSCRIPTION_1605);
      expect(
        await context.testDatabase.getClient().select().from(subscriptionEventReceipt),
      ).toEqual([]);
    } finally {
      await release();
    }
    const retried = await webhook(payload).expect(200);

    // Then
    expect(retried.body.data).toEqual({ received: true });
    expect(await storedUser(user.userId)).toMatchObject({ subscriptionStatus: "ACTIVE" });
    expect(
      await context.testDatabase.getClient().select().from(subscriptionEventReceipt),
    ).toHaveLength(1);
  });

  it("잘못된 인증은 401로 차단하고 raw secret 인증의 잘못된 payload는 기존처럼 200으로 수신한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("billing-auth@example.com", "Test1234!");
    const payload = purchase(user.userId, "billing-auth");

    // When
    const unauthorized = await webhook(payload, "invalid-secret").expect(401);
    await request(context.app.getHttpServer())
      .post("/v1/webhooks/revenuecat")
      .send(payload)
      .expect(401);
    const invalidPayload = await webhook(
      { event: { type: "INITIAL_PURCHASE" } },
      webhookSecret,
    ).expect(200);

    // Then
    expect(unauthorized.body.error.code).toBe(ErrorCode.SUBSCRIPTION_1601);
    expect(invalidPayload.body.data).toEqual({ received: true });
    expect(await storedUser(user.userId)).toMatchObject({ subscriptionStatus: "FREE" });
    expect(await context.testDatabase.getClient().select().from(subscriptionEventReceipt)).toEqual(
      [],
    );
    expect(await context.testDatabase.getClient().select().from(subscription)).toEqual([]);
  });

  it("/me는 보상 기간 출처·지금 기간 끝·전체 끝·자동 갱신 여부·대기 중인 보상 일수를 optional 필드로 함께 반환한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("premium-grant-me@test.com", "Test1234!");
    const before = await request(context.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);
    await context.module.get<PremiumGranterPort>(PremiumGranterPort).grant({
      userId: UserId.reconstitute(user.userId),
      source: "INVITE",
      sourceKey: "invite:me",
      durationDays: 7,
    });

    const afterFirst = await request(context.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    // When
    await context.module.get<PremiumGranterPort>(PremiumGranterPort).grant({
      userId: UserId.reconstitute(user.userId),
      source: "INVITE",
      sourceKey: "invite:me-2",
      durationDays: 7,
    });
    const after = await request(context.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .expect(200);

    // Then
    expect(currentUserSchema.parse(before.body.data)).toMatchObject({
      subscriptionStatus: "FREE",
      premiumSource: null,
      premiumEndsAt: null,
      premiumPeriodEndsAt: null,
      willRenew: false,
      bankedPremiumDays: 0,
    });
    expect(currentUserSchema.parse(afterFirst.body.data)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: "2027-01-11T12:00:00.000Z",
      premiumSource: "GRANT",
      premiumEndsAt: "2027-01-11T12:00:00.000Z",
      premiumPeriodEndsAt: "2027-01-11T12:00:00.000Z",
      willRenew: false,
      bankedPremiumDays: 0,
    });
    // 보상 기간 중 또 받은 보상은 지금 기간 뒤에 쌓여 전체 끝만 늘어난다
    expect(currentUserSchema.parse(after.body.data)).toMatchObject({
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: "2027-01-18T12:00:00.000Z",
      premiumSource: "GRANT",
      premiumEndsAt: "2027-01-18T12:00:00.000Z",
      premiumPeriodEndsAt: "2027-01-11T12:00:00.000Z",
      willRenew: false,
      bankedPremiumDays: 7,
    });
  });

  it("/me는 보상 기간이 끝난 FREE 사용자에게 7일 동안만 끝난 시각을 알려 준다", async () => {
    // Given
    const email = "premium-grant-ended@test.com";
    const password = "Test1234!";
    const user = await context.helpers.createVerifiedUser(email, password);
    await context.module.get<PremiumGranterPort>(PremiumGranterPort).grant({
      userId: UserId.reconstitute(user.userId),
      source: "INVITE",
      sourceKey: "invite:ended",
      durationDays: 1,
    });
    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const authCache = context.module.get<AuthCachePort>(AuthCachePort, { strict: false });
    const meAt = async (time: Date) => {
      vi.setSystemTime(time);
      await authCache.invalidateUserProfile(UserId.reconstitute(user.userId));
      const { accessToken } = await context.helpers.loginUser(email, password);
      const response = await request(context.app.getHttpServer())
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      return currentUserSchema.parse(response.body.data);
    };

    // When
    const justEnded = await meAt(endsAt);
    const lastMoment = await meAt(new Date(endsAt.getTime() + 7 * 24 * 60 * 60 * 1000 - 1));
    const afterWindow = await meAt(new Date(endsAt.getTime() + 7 * 24 * 60 * 60 * 1000));

    // Then
    expect(justEnded).toMatchObject({
      premiumSource: null,
      premiumEndsAt: null,
      premiumPeriodEndsAt: null,
      premiumGrantEndedAt: endsAt.toISOString(),
    });
    expect(lastMoment.premiumGrantEndedAt).toBe(endsAt.toISOString());
    expect(afterWindow.premiumGrantEndedAt).toBeNull();
  });

  it("/me는 스토어 무료 체험 중이면 premiumIsTrial=true와 스토어가 준 체험 끝을, 전환 뒤에는 false를 반환한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("billing-trial@example.com", "Test1234!");
    const trialEndsAt = new Date("2027-02-04T00:00:00.000Z");
    const nextYear = new Date("2028-02-28T00:00:00.000Z");
    const trial = SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(user.userId)
      .withOriginalTransactionId("billing-trial")
      .withEventId("billing-trial-start")
      .withPeriodType("TRIAL")
      .withPrice(0)
      .withPurchasedAtMs(at.getTime())
      .withExpirationAtMs(trialEndsAt.getTime())
      .build();
    const conversion = SubscriptionEventBuilder.renewal()
      .withAppUserId(user.userId)
      .withOriginalTransactionId("billing-trial")
      .withEventId("billing-trial-convert")
      .withTrialConversion()
      .withExpirationAtMs(nextYear.getTime())
      .build();

    // When
    const before = currentUserSchema.parse(
      (await currentUser(user.accessToken).expect(200)).body.data,
    );
    await webhook(trial).expect(200);
    const during = currentUserSchema.parse(
      (await currentUser(user.accessToken).expect(200)).body.data,
    );
    await webhook(conversion).expect(200);
    const after = currentUserSchema.parse(
      (await currentUser(user.accessToken).expect(200)).body.data,
    );

    // Then
    expect(before.premiumIsTrial).toBe(false);
    expect(during).toMatchObject({
      premiumSource: "STORE",
      premiumIsTrial: true,
      willRenew: true,
      premiumPeriodEndsAt: trialEndsAt.toISOString(),
    });
    expect(after).toMatchObject({
      premiumIsTrial: false,
      premiumPeriodEndsAt: nextYear.toISOString(),
    });
  });

  it.each([
    { productId: "com.aido.pro.monthly", expected: "MONTHLY" },
    { productId: "com.aido.pro.yearly:yearly-base", expected: "ANNUAL" },
    { productId: "premium_monthly", expected: null },
  ])(
    "/me는 스토어 상품 $productId의 요금제를 premiumPlanType $expected로 반환한다",
    async ({ productId, expected }) => {
      // Given
      const user = await context.helpers.createVerifiedUser(
        "billing-plan@example.com",
        "Test1234!",
      );
      const purchased = SubscriptionEventBuilder.initialPurchase()
        .withAppUserId(user.userId)
        .withOriginalTransactionId("billing-plan")
        .withEventId("billing-plan-purchase")
        .withProductId(productId)
        .withPurchasedAtMs(at.getTime())
        .withExpirationAtMs(futureExpiry.getTime())
        .build();

      // When
      const before = currentUserSchema.parse(
        (await currentUser(user.accessToken).expect(200)).body.data,
      );
      await webhook(purchased).expect(200);
      const after = currentUserSchema.parse(
        (await currentUser(user.accessToken).expect(200)).body.data,
      );

      // Then
      expect(before.premiumPlanType).toBeNull();
      expect(after).toMatchObject({ premiumSource: "STORE", premiumPlanType: expected });
    },
  );
});
