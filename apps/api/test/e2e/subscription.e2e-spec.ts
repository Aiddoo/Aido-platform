import type { RevenueCatWebhookPayload } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import request from "supertest";

import {
  SUBSCRIPTION_WEBHOOK_LOCK,
  type SubscriptionWebhookLockPort,
} from "#api/modules/billing/application/ports/subscriptions/subscription-webhook-lock.port";
import { decodeRecord } from "#api/platform/database/database-records";
import { SubscriptionEventBuilder } from "#test/builders/subscription-event.builder";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const webhookSecret = "subscription-e2e-webhook-secret";
const at = new Date("2027-01-04T12:00:00.000Z");
const pastExpiry = new Date("2027-01-03T12:00:00.000Z");
const futureExpiry = new Date("2027-02-03T12:00:00.000Z");

describe("구독 Webhook HTTP 계약과 권한 캐시 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_SECRET", webhookSecret);
    context = await createE2eApp();
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
    try {
      await destroyE2eApp(context);
    } finally {
      vi.unstubAllEnvs();
    }
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
      .withPurchasedAtMs(pastExpiry.getTime() - 30 * 24 * 60 * 60 * 1_000)
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
    return decodeRecord(
      "User",
      await context.testDatabase
        .getClient()
        .orm.public.User.where((row) => row.id.eq(userId))
        .first(),
    );
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
      subscriptionExpiresAt: futureExpiry,
    });
    expect(
      await context.testDatabase.getClient().orm.public.SubscriptionEventReceipt.all(),
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
      subscriptionExpiresAt: futureExpiry,
    });
    expect(
      await context.testDatabase.getClient().orm.public.SubscriptionEventReceipt.all(),
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
        subscriptionExpiresAt: futureExpiry,
      });
      expect(
        await context.testDatabase.getClient().orm.public.SubscriptionEventReceipt.all(),
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
    const lock = context.module.get<SubscriptionWebhookLockPort>(SUBSCRIPTION_WEBHOOK_LOCK);
    const release = await lock.acquire(user.userId);
    if (release === null) throw new Error("테스트 Webhook 잠금 획득 실패");
    const payload = purchase(user.userId, "billing-lock");

    // When
    try {
      const rejected = await webhook(payload).expect(429);
      expect(rejected.body.error.code).toBe(ErrorCode.SUBSCRIPTION_1605);
      expect(
        await context.testDatabase.getClient().orm.public.SubscriptionEventReceipt.all(),
      ).toEqual([]);
    } finally {
      await release();
    }
    const retried = await webhook(payload).expect(200);

    // Then
    expect(retried.body.data).toEqual({ received: true });
    expect(await storedUser(user.userId)).toMatchObject({ subscriptionStatus: "ACTIVE" });
    expect(
      await context.testDatabase.getClient().orm.public.SubscriptionEventReceipt.all(),
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
    expect(
      await context.testDatabase.getClient().orm.public.SubscriptionEventReceipt.all(),
    ).toEqual([]);
    expect(await context.testDatabase.getClient().orm.public.Subscription.all()).toEqual([]);
  });
});
