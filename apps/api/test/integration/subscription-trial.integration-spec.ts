import type { RevenueCatWebhookPayload } from "@aido/api";
import { and, eq, sql } from "drizzle-orm";

import { PremiumAccessReaderPort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { SubscriptionEventNotifierPort } from "#api/modules/billing/subscriptions/application/ports/subscription-event-notifier.port";
import { TrialEndingNoticeRepositoryPort } from "#api/modules/billing/subscriptions/application/ports/trial-ending-notice.repository.port";
import type { SubscriptionEventPayload } from "#api/modules/billing/subscriptions/application/read-models/subscription-event-payload.read-model";
import { NotifyEndingTrialsUseCase } from "#api/modules/billing/subscriptions/application/use-cases/notify-ending-trials.use-case";
import { RevenueCatWebhookReceiver } from "#api/modules/billing/subscriptions/infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  notification,
  subscription,
  user as userTable,
  userPreference,
} from "#api/platform/database/schema/index";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { SubscriptionEventBuilder, UserPreferenceBuilder } from "#test/builders/index";
import { toDateOrNull } from "#test/fixtures/billing/subscription.fixture";
import { UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// 런던 12:00(낮), 서울 21:00(야간)
const at = new Date("2027-01-04T12:00:00.000Z");
const trialStartedAt = new Date("2026-12-07T12:00:00.000Z");
const trialEndsAt = new Date("2027-01-07T00:00:00.000Z");
const nextYear = new Date("2028-01-07T00:00:00.000Z");

const events: SubscriptionEventPayload[] = [];
const notifier: SubscriptionEventNotifierPort = {
  notifySubscriptionEvent: (payload) => {
    events.push(payload);
  },
  recordBillingIssue: async () => {},
  reportWebhookFailure: () => {},
};

describe("무료 체험 구독 저장과 종료 3일 전 안내 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let webhook: RevenueCatWebhookReceiver;
  let notifyEndingTrials: NotifyEndingTrialsUseCase;
  let noticeSource: TrialEndingNoticeRepositoryPort;
  let premiumAccess: PremiumAccessReaderPort;
  let unitOfWork: UnitOfWorkPort;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 5 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder.overrideProvider(SubscriptionEventNotifierPort).useValue(notifier),
    });
    webhook = context.module.get(RevenueCatWebhookReceiver);
    notifyEndingTrials = context.module.get(NotifyEndingTrialsUseCase);
    noticeSource = context.module.get(TrialEndingNoticeRepositoryPort);
    premiumAccess = context.module.get(PremiumAccessReaderPort);
    unitOfWork = context.module.get(UnitOfWorkPort);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    events.length = 0;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function givenUser(tag: string, timezone = "Europe/London"): Promise<string> {
    const user = UserFixture.create({
      id: createEntityId(),
      email: `trial-${tag.toLowerCase()}@example.com`,
      userTag: tag,
      subscriptionStatus: "FREE",
      createdAt: instantFromDate(trialStartedAt),
      updatedAt: instantFromDate(trialStartedAt),
    });
    await client.insert(userTable).values(user);
    await client
      .insert(userPreference)
      .values(UserPreferenceBuilder.create(user.id).withTimezone(timezone).build());
    return user.id;
  }

  function chainOf(userId: string): string {
    return `trial-chain-${userId}`;
  }

  function trialPurchase(userId: string): RevenueCatWebhookPayload {
    return SubscriptionEventBuilder.initialPurchase()
      .withAppUserId(userId)
      .withOriginalTransactionId(chainOf(userId))
      .withTransactionId(chainOf(userId))
      .withEventId(`start-${userId}`)
      .withPeriodType("TRIAL")
      .withProductId("com.aido.pro.yearly")
      .withPrice(0)
      .withPurchasedAtMs(trialStartedAt.getTime())
      .withExpirationAtMs(trialEndsAt.getTime())
      .build();
  }

  function trialEvent(
    userId: string,
    builder: SubscriptionEventBuilder,
    eventId: string,
    expiresAt: Date = trialEndsAt,
  ): RevenueCatWebhookPayload {
    return builder
      .withAppUserId(userId)
      .withOriginalTransactionId(chainOf(userId))
      .withTransactionId(chainOf(userId))
      .withEventId(eventId)
      .withExpirationAtMs(expiresAt.getTime())
      .build();
  }

  async function storedTrial(userId: string) {
    const row = await client.query.subscription.findFirst({
      columns: { periodType: true, status: true, expiresAt: true, trialEndingNotifiedAt: true },
      where: { revenueCatId: chainOf(userId) },
    });
    return row == null
      ? row
      : {
          ...row,
          expiresAt: toDateOrNull(row.expiresAt),
          trialEndingNotifiedAt: toDateOrNull(row.trialEndingNotifiedAt),
        };
  }

  async function trialNotices(userId?: string) {
    return client
      .select({ userId: notification.userId, title: notification.title })
      .from(notification)
      .where(
        and(
          eq(notification.type, "PREMIUM_TRIAL_ENDING"),
          userId == null ? undefined : eq(notification.userId, userId),
        ),
      );
  }

  describe("웹훅", () => {
    it("체험 시작 → 해지 → 만료: 체험 끝까지 프리미엄, 끝나면 무료이고 관리자 알림은 체험 단계로 간다", async () => {
      // Given
      const userId = await givenUser("TRIALA01");

      // When
      await webhook.receive({ body: trialPurchase(userId) });
      const started = await premiumAccess.getPremiumAccess(UserId.reconstitute(userId));
      await webhook.receive({
        body: trialEvent(
          userId,
          SubscriptionEventBuilder.cancellation().withPeriodType("TRIAL"),
          "cancel",
        ),
      });
      const cancelled = await premiumAccess.getPremiumAccess(UserId.reconstitute(userId));
      vi.setSystemTime(new Date(trialEndsAt.getTime() + 60_000));
      await webhook.receive({
        body: trialEvent(
          userId,
          SubscriptionEventBuilder.expiration()
            .withPeriodType("TRIAL")
            .withExpirationReason("UNSUBSCRIBE"),
          "expire",
        ),
      });
      const expired = await premiumAccess.getPremiumAccess(UserId.reconstitute(userId));

      // Then
      expect(started).toMatchObject({
        source: "STORE",
        isTrial: true,
        willRenew: true,
        periodEndsAt: trialEndsAt,
      });
      expect(cancelled).toMatchObject({ source: "STORE", isTrial: true, willRenew: false });
      expect(expired).toMatchObject({ source: null, isTrial: false });
      expect(await storedTrial(userId)).toMatchObject({ periodType: "TRIAL", status: "EXPIRED" });
      expect(events.map((event) => event.lifecycle)).toEqual([
        "trial_started",
        "trial_cancelled",
        "trial_expired",
      ]);
    });

    it("체험 시작 → 결제 전환: NORMAL로 바뀌고 다음 결제일은 스토어 만료 시각 그대로다", async () => {
      // Given
      const userId = await givenUser("TRIALB01");
      await webhook.receive({ body: trialPurchase(userId) });

      // When
      await webhook.receive({
        body: trialEvent(
          userId,
          SubscriptionEventBuilder.renewal().withTrialConversion().withPrice(19.99, "KRW", 29_900),
          "convert",
          nextYear,
        ),
      });

      // Then
      expect(await storedTrial(userId)).toMatchObject({
        periodType: "NORMAL",
        status: "ACTIVE",
        expiresAt: nextYear,
      });
      expect(await premiumAccess.getPremiumAccess(UserId.reconstitute(userId))).toMatchObject({
        isTrial: false,
        willRenew: true,
        periodEndsAt: nextYear,
      });
      expect(events.at(-1)?.lifecycle).toBe("trial_converted");
    });

    it("중복 전송과 전환 뒤 늦게 온 체험 해지·만료는 결제된 상태를 되돌리지 않는다", async () => {
      // Given
      const userId = await givenUser("TRIALC01");
      await webhook.receive({ body: trialPurchase(userId) });
      const conversion = trialEvent(
        userId,
        SubscriptionEventBuilder.renewal().withTrialConversion(),
        "convert",
        nextYear,
      );
      await webhook.receive({ body: conversion });

      // When
      await webhook.receive({ body: trialPurchase(userId) });
      await webhook.receive({ body: conversion });
      await webhook.receive({
        body: trialEvent(
          userId,
          SubscriptionEventBuilder.cancellation().withPeriodType("TRIAL"),
          "late-cancel",
        ),
      });
      await webhook.receive({
        body: trialEvent(
          userId,
          SubscriptionEventBuilder.expiration().withPeriodType("TRIAL"),
          "late-expire",
        ),
      });

      // Then
      expect(await storedTrial(userId)).toMatchObject({
        periodType: "NORMAL",
        status: "ACTIVE",
        expiresAt: nextYear,
      });
      expect(
        await client.query.user.findFirst({
          columns: { subscriptionStatus: true, subscriptionExpiresAt: true },
          where: { id: userId },
        }),
      ).toEqual({ subscriptionStatus: "ACTIVE", subscriptionExpiresAt: instantFromDate(nextYear) });
      expect(events.map((event) => event.lifecycle)).toEqual(["trial_started", "trial_converted"]);
    });
  });

  describe("종료 3일 전 안내 sweep", () => {
    it("3일 안에 끝나는 체험을 한 번만 알리고 다시 돌아도 보내지 않는다", async () => {
      // Given
      const renewingUserId = await givenUser("TRIALD01");
      const cancelledUserId = await givenUser("TRIALD02");
      await webhook.receive({ body: trialPurchase(renewingUserId) });
      await webhook.receive({ body: trialPurchase(cancelledUserId) });
      await webhook.receive({
        body: trialEvent(
          cancelledUserId,
          SubscriptionEventBuilder.cancellation().withPeriodType("TRIAL"),
          "cancel",
        ),
      });

      // When
      const first = await notifyEndingTrials.execute({ now: instantFromDate(at) });
      const second = await notifyEndingTrials.execute({ now: instantFromDate(at) });

      // Then
      expect(first.notifiedCount).toBe(2);
      expect(second.notifiedCount).toBe(0);
      const notices = await trialNotices();
      expect(notices).toHaveLength(2);
      expect(notices.find((notice) => notice.userId === renewingUserId)?.title).toBe(
        "3일 뒤 연간 구독이 시작돼요",
      );
      expect(notices.find((notice) => notice.userId === cancelledUserId)?.title).toBe(
        "무료 체험이 3일 뒤 끝나요",
      );
      expect((await storedTrial(renewingUserId))?.trialEndingNotifiedAt).toEqual(at);
    });

    it("현지 야간(서울 21시)이면 표시하지 않고 미뤄 아침 실행이 보낸다", async () => {
      // Given
      const userId = await givenUser("TRIALE01", "Asia/Seoul");
      await webhook.receive({ body: trialPurchase(userId) });
      const seoulMorning = new Date("2027-01-04T23:30:00.000Z");

      // When
      const night = await notifyEndingTrials.execute({ now: instantFromDate(at) });
      const afterNight = await trialNotices(userId);
      const morning = await notifyEndingTrials.execute({ now: instantFromDate(seoulMorning) });

      // Then
      expect(night).toMatchObject({ notifiedCount: 0, deferredCount: 1 });
      expect(afterNight).toEqual([]);
      expect(morning.notifiedCount).toBe(1);
      expect(await trialNotices(userId)).toHaveLength(1);
    });

    it("3일보다 많이 남은 체험과 이미 결제로 넘어간 체험은 고르지 않는다", async () => {
      // Given
      const earlyUserId = await givenUser("TRIALF01");
      const convertedUserId = await givenUser("TRIALF02");
      await webhook.receive({ body: trialPurchase(earlyUserId) });
      await webhook.receive({ body: trialPurchase(convertedUserId) });
      await webhook.receive({
        body: trialEvent(
          convertedUserId,
          SubscriptionEventBuilder.renewal().withTrialConversion(),
          "convert",
          nextYear,
        ),
      });
      const fourDaysBefore = new Date(trialEndsAt.getTime() - 4 * DAY_MS);

      // When
      const result = await notifyEndingTrials.execute({ now: instantFromDate(fourDaysBefore) });
      const atNotice = await notifyEndingTrials.execute({ now: instantFromDate(at) });

      // Then
      expect(result.notifiedCount).toBe(0);
      expect(atNotice.notifiedCount).toBe(1);
      expect(await trialNotices(convertedUserId)).toEqual([]);
    });

    it("두 실행이 같은 체험을 동시에 표시하면 행 잠금 뒤 한 실행만 얻는다", async () => {
      // Given
      const userId = await givenUser("TRIALG01");
      await webhook.receive({ body: trialPurchase(userId) });
      const [notice] = await noticeSource.listDue({
        now: instantFromDate(at),
        endsBefore: instantFromDate(trialEndsAt),
        limit: 1,
      });
      const notices = notice == null ? [] : [notice];
      const firstClaimed = Promise.withResolvers<void>();
      const releaseFirst = Promise.withResolvers<void>();

      // When
      const first = unitOfWork.run(async () => {
        const claimed = await noticeSource.claim(notices, instantFromDate(at));
        firstClaimed.resolve();
        await releaseFirst.promise;
        return claimed;
      });
      await firstClaimed.promise;
      const second = unitOfWork.run(() => noticeSource.claim(notices, instantFromDate(at)));
      try {
        await vi.waitFor(
          async () => {
            const waiting = await client.execute<{ count: number }>(sql`
              SELECT count(*)::int AS count FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'
                AND query ILIKE '%update "Subscription"%trialEndingNotifiedAt%'
            `);
            expect(waiting.rows[0]?.count).toBe(1);
          },
          { timeout: 10_000 },
        );
      } finally {
        releaseFirst.resolve();
      }

      // Then
      expect(await first).toEqual(notices);
      expect(notices).toHaveLength(1);
      expect(await second).toEqual([]);
    });

    it("두 sweep이 동시에 돌아도 알림은 하나다", async () => {
      // Given
      const userId = await givenUser("TRIALH01");
      await webhook.receive({ body: trialPurchase(userId) });

      // When
      const results = await Promise.all([
        notifyEndingTrials.execute({ now: instantFromDate(at) }),
        notifyEndingTrials.execute({ now: instantFromDate(at) }),
      ]);

      // Then
      expect(results.map((result) => result.notifiedCount).sort()).toEqual([0, 1]);
      expect(await trialNotices(userId)).toHaveLength(1);
      expect(
        await client
          .select({ id: subscription.id })
          .from(subscription)
          .where(eq(subscription.userId, userId)),
      ).toHaveLength(1);
    });
  });
});
