import { currentUserSchema, type RevenueCatWebhookPayload } from "@aido/api";
import request from "supertest";

import { STORE_RENEWAL_GRACE_MS } from "#api/modules/billing/shared/store-renewal-grace.domain-service";
import { billingSubscriptionsConfig } from "#api/modules/billing/subscriptions/billing-subscriptions.config";
import { PremiumGranterPort } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { subscription } from "#api/platform/database/schema/index";
import { SubscriptionEventBuilder } from "#test/builders/subscription-event.builder";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const webhookSecret = "subscription-trial-invite-webhook-secret";
const DAY_MS = 24 * 60 * 60 * 1_000;
// 2월 15일에 시작한 2주 체험을 스토어가 윤년 2월 29일로 끝낸다
const TRIAL_STARTED_AT = new Date("2028-02-15T09:00:00.000Z");
const TRIAL_ENDS_AT = new Date("2028-02-29T09:00:00.000Z");
const INVITED_AT = new Date("2028-02-18T09:00:00.000Z");
const CANCELLED_AT = new Date("2028-02-22T09:00:00.000Z");
const GRANT_ENDS_AT = new Date(TRIAL_ENDS_AT.getTime() + 7 * DAY_MS);
const CHAIN = "trial-invite-chain";
const EMAIL = "trial-invite@example.com";
const PASSWORD = "Test1234!";

describe("무료 체험 중 받은 초대 보상과 체험 종료 뒤 /me (실제 PostgreSQL)", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    context = await createE2eApp({
      customizeBuilder: (builder) =>
        builder.overrideProvider(billingSubscriptionsConfig.KEY).useValue({
          revenuecat: { webhookSecret, projectId: undefined, apiV2SecretKey: undefined },
        }),
    });
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(TRIAL_STARTED_AT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  function webhook(body: RevenueCatWebhookPayload) {
    return request(context.app.getHttpServer())
      .post("/v1/webhooks/revenuecat")
      .set("Authorization", `Bearer ${webhookSecret}`)
      .send(body)
      .expect(200);
  }

  function trialEvent(
    builder: SubscriptionEventBuilder,
    userId: string,
    eventId: string,
  ): RevenueCatWebhookPayload {
    return builder
      .withAppUserId(userId)
      .withOriginalTransactionId(CHAIN)
      .withTransactionId(CHAIN)
      .withEventId(eventId)
      .withPeriodType("TRIAL")
      .withProductId("premium_monthly")
      .withPurchasedAtMs(TRIAL_STARTED_AT.getTime())
      .withExpirationAtMs(TRIAL_ENDS_AT.getTime())
      .build();
  }

  async function meAt(time: Date) {
    vi.setSystemTime(time);
    const { accessToken } = await context.helpers.loginUser(EMAIL, PASSWORD);
    const response = await request(context.app.getHttpServer())
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return currentUserSchema.parse(response.body.data);
  }

  it("체험 중 받은 7일은 쌓였다가, 해지한 체험이 끝나면 그 시각부터 정확히 7일 GRANT로 이어지고 끝나면 무료다", async () => {
    // Given
    const { userId } = await context.helpers.createVerifiedUser(EMAIL, PASSWORD);
    await webhook(
      trialEvent(SubscriptionEventBuilder.initialPurchase().withPrice(0), userId, "trial-start"),
    );
    vi.setSystemTime(INVITED_AT);
    await context.module
      .get<PremiumGranterPort>(PremiumGranterPort)
      .grant({ userId, source: "INVITE", sourceKey: "invite:trial", durationDays: 7 });

    // When
    const duringTrial = await meAt(INVITED_AT);
    vi.setSystemTime(CANCELLED_AT);
    await webhook(trialEvent(SubscriptionEventBuilder.cancellation(), userId, "trial-cancel"));
    const afterCancel = await meAt(CANCELLED_AT);
    const trialEndedAt = new Date(TRIAL_ENDS_AT.getTime() + 5 * 60_000);
    vi.setSystemTime(trialEndedAt);
    await webhook(
      trialEvent(
        SubscriptionEventBuilder.expiration().withExpirationReason("UNSUBSCRIBE"),
        userId,
        "trial-expire",
      ),
    );
    const afterTrial = await meAt(trialEndedAt);
    const grantLastMoment = await meAt(new Date(GRANT_ENDS_AT.getTime() - 1));
    const afterGrant = await meAt(new Date(GRANT_ENDS_AT.getTime() + 1_000));

    // Then 스토어가 보낸 체험 끝(윤년 2월 29일)을 서버가 다시 계산하지 않고 그대로 쓴다
    expect(
      await context.testDatabase
        .getClient()
        .select({ expiresAt: subscription.expiresAt, periodType: subscription.periodType })
        .from(subscription),
    ).toEqual([
      {
        expiresAt: Temporal.Instant.fromEpochMilliseconds(TRIAL_ENDS_AT.getTime()),
        periodType: "TRIAL",
      },
    ]);
    expect(duringTrial).toMatchObject({
      isPremium: true,
      premiumSource: "STORE",
      premiumIsTrial: true,
      willRenew: true,
      premiumPeriodEndsAt: TRIAL_ENDS_AT.toISOString(),
      premiumEndsAt: new Date(GRANT_ENDS_AT.getTime() + STORE_RENEWAL_GRACE_MS).toISOString(),
      bankedPremiumDays: 7,
    });
    expect(afterCancel).toMatchObject({
      isPremium: true,
      premiumSource: "STORE",
      premiumIsTrial: true,
      willRenew: false,
      premiumPeriodEndsAt: TRIAL_ENDS_AT.toISOString(),
      premiumEndsAt: GRANT_ENDS_AT.toISOString(),
      bankedPremiumDays: 7,
    });
    expect(afterTrial).toMatchObject({
      isPremium: true,
      premiumSource: "GRANT",
      premiumIsTrial: false,
      willRenew: false,
      premiumPeriodEndsAt: GRANT_ENDS_AT.toISOString(),
      premiumEndsAt: GRANT_ENDS_AT.toISOString(),
      bankedPremiumDays: 0,
    });
    expect(grantLastMoment).toMatchObject({ isPremium: true, premiumSource: "GRANT" });
    expect(afterGrant).toMatchObject({
      isPremium: false,
      premiumSource: null,
      premiumEndsAt: null,
      premiumIsTrial: false,
      bankedPremiumDays: 0,
      premiumGrantEndedAt: GRANT_ENDS_AT.toISOString(),
    });
  });
});
