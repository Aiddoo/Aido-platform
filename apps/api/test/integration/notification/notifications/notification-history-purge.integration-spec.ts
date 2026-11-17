import { PurgeNotificationHistoryUseCase } from "#api/modules/notification/notifications/application/use-cases/purge-notification-history.use-case";
import { DrizzleNotificationRepository } from "#api/modules/notification/notifications/infrastructure/persistence/drizzle-notification.repository";
import { PurgePushDeliveryHistoryUseCase } from "#api/modules/notification/push-dispatches/application/use-cases/purge-push-delivery-history.use-case";
import { DrizzlePushDeliveryHistoryRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-delivery-history.repository";
import {
  notification,
  pushDeliveryAttempt,
  pushDispatch,
  pushDispatchOutbox,
  pushRateLimitReservation,
  pushToken,
  user as userTable,
} from "#api/platform/database/schema/index";
import { PassThroughNotificationCache } from "#test/doubles/notification/pass-through-notification-cache";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const NOW = Temporal.Instant.from("2026-11-18T18:50:00Z");
const NOTIFICATION_CUTOFF = NOW.subtract({ hours: 24 * 180 });
const DISPATCH_CUTOFF = NOW.subtract({ hours: 24 * 30 });
const RESERVATION_CUTOFF = NOW.subtract({ hours: 48 });
const JUST_BEFORE = { milliseconds: 1 } as const;
const BROADCAST_CAMPAIGN_KEY = "admin-broadcast:campaign-1";

describe("알림·발송 기록 보관 기간 정리 (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let userId: string;

  beforeAll(async () => {
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    const user = UserFixture.create();
    await client.insert(userTable).values(user);
    userId = user.id;
  });

  afterAll(async () => {
    await database.stop();
  });

  function createPurge(): PurgeNotificationHistoryUseCase {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    const clock = new FixedClock(NOW);
    return new PurgeNotificationHistoryUseCase({
      notificationRepository: new DrizzleNotificationRepository(transactionHost),
      purgePushDeliveryHistory: new PurgePushDeliveryHistoryUseCase({
        history: new DrizzlePushDeliveryHistoryRepository(transactionHost),
        clock,
        logger: new SilentLogger(),
      }),
      notificationCache: new PassThroughNotificationCache(),
      clock,
      logger: new SilentLogger(),
    });
  }

  async function insertNotification(
    title: string,
    createdAt: Temporal.Instant,
    overrides: Partial<typeof notification.$inferInsert> = {},
  ): Promise<number> {
    const [row] = await client
      .insert(notification)
      .values({ userId, type: "SYSTEM_NOTICE", title, body: "본문", createdAt, ...overrides })
      .returning({ id: notification.id });
    if (row == null) {
      throw new Error("알림을 넣지 못했다");
    }
    return row.id;
  }

  async function insertDispatch(
    notificationId: number,
    status: (typeof pushDispatch.$inferInsert)["status"],
    times: { readonly scheduledAt: Temporal.Instant; readonly updatedAt: Temporal.Instant },
    campaignKey: string | null = null,
  ): Promise<number> {
    const [row] = await client
      .insert(pushDispatch)
      .values({ notificationId, userId, purpose: "TRANSACTIONAL", status, campaignKey, ...times })
      .returning({ id: pushDispatch.id });
    if (row == null) {
      throw new Error("발송을 넣지 못했다");
    }
    return row.id;
  }

  async function remainingTitles(): Promise<string[]> {
    const rows = await client.select({ title: notification.title }).from(notification);
    return rows.map(({ title }) => title).toSorted();
  }

  async function remainingDispatchIds(): Promise<number[]> {
    const rows = await client.select({ id: pushDispatch.id }).from(pushDispatch);
    return rows.map(({ id }) => id).toSorted((left, right) => left - right);
  }

  it("알림은 180일 경계 직전만 지우고 경계 시각의 알림과 한 번뿐인 마일스톤 알림은 남긴다", async () => {
    // Given
    await insertNotification("경계 직전", NOTIFICATION_CUTOFF.subtract(JUST_BEFORE));
    await insertNotification("경계", NOTIFICATION_CUTOFF);
    await insertNotification("마일스톤", NOTIFICATION_CUTOFF.subtract({ hours: 24 * 10 }), {
      type: "WEEKLY_ACHIEVEMENT",
      metadata: { milestone: "STREAK_3" },
    });
    await insertNotification("주간 성취", NOTIFICATION_CUTOFF.subtract({ hours: 24 * 10 }), {
      type: "WEEKLY_ACHIEVEMENT",
      metadata: { weekLabel: "11월 2주차" },
    });

    // When
    await createPurge().execute();

    // Then
    expect(await remainingTitles()).toEqual(["경계", "마일스톤"]);
  });

  it("한 묶음(500개)보다 많은 오래된 알림도 한 실행에서 이어 지운다", async () => {
    // Given
    const oldest = NOTIFICATION_CUTOFF.subtract({ hours: 24 * 5 });
    await client.insert(notification).values(
      Array.from({ length: 501 }, (_, index) => ({
        userId,
        type: "SYSTEM_NOTICE" as const,
        title: `오래된 ${index}`,
        body: "본문",
        createdAt: oldest.add({ seconds: index }),
      })),
    );
    await insertNotification("최근", NOW);

    // When
    await createPurge().execute();

    // Then
    expect(await remainingTitles()).toEqual(["최근"]);
  });

  it("끝난 지 30일이 지난 발송만 기기 결과·outbox와 함께 지우고 진행 중·최근에 바뀐·관리자 캠페인 발송은 남긴다", async () => {
    // Given
    const old = DISPATCH_CUTOFF.subtract(JUST_BEFORE);
    const finishedBeforeCutoff = await insertDispatch(
      await insertNotification("끝난 발송", NOW),
      "SENT",
      { scheduledAt: old, updatedAt: old },
    );
    const finishedAtCutoff = await insertDispatch(
      await insertNotification("경계 발송", NOW),
      "SKIPPED",
      { scheduledAt: DISPATCH_CUTOFF, updatedAt: DISPATCH_CUTOFF },
    );
    const stillProcessing = await insertDispatch(
      await insertNotification("진행 중", NOW),
      "PROCESSING",
      { scheduledAt: old, updatedAt: old },
    );
    const reopenedLater = await insertDispatch(
      await insertNotification("최근에 바뀜", NOW),
      "FAILED",
      { scheduledAt: old, updatedAt: NOW },
    );
    const broadcast = await insertDispatch(
      await insertNotification("캠페인", NOW, {
        type: "ADMIN_BROADCAST",
        campaignKey: BROADCAST_CAMPAIGN_KEY,
      }),
      "SENT",
      { scheduledAt: old, updatedAt: old },
      BROADCAST_CAMPAIGN_KEY,
    );
    const [token] = await client
      .insert(pushToken)
      .values({
        userId,
        token: "ExponentPushToken[purge]",
        deviceId: "purge-device",
        platform: "IOS",
        updatedAt: old,
      })
      .returning({ id: pushToken.id });
    await client.insert(pushDeliveryAttempt).values({
      dispatchId: finishedBeforeCutoff,
      pushTokenId: token?.id ?? 0,
      status: "DELIVERED",
      updatedAt: old,
    });
    await client
      .insert(pushDispatchOutbox)
      .values({ dispatchId: finishedBeforeCutoff, deliveryMode: "SINGLE", updatedAt: old });

    // When
    await createPurge().execute();

    // Then
    expect(await remainingDispatchIds()).toEqual([
      finishedAtCutoff,
      stillProcessing,
      reopenedLater,
      broadcast,
    ]);
    expect(await client.select().from(pushDeliveryAttempt)).toEqual([]);
    expect(await client.select().from(pushDispatchOutbox)).toEqual([]);
    expect(await remainingTitles()).toEqual([
      "경계 발송",
      "끝난 발송",
      "진행 중",
      "최근에 바뀜",
      "캠페인",
    ]);
  });

  it("예약 시각이 같은 끝난 발송이 한 묶음(500개)보다 많아도 한 실행에서 이어 지운다", async () => {
    // Given
    const old = DISPATCH_CUTOFF.subtract({ hours: 24 });
    const notifications = await client
      .insert(notification)
      .values(
        Array.from({ length: 501 }, (_, index) => ({
          userId,
          type: "SYSTEM_NOTICE" as const,
          title: `같은 예약 ${index}`,
          body: "본문",
          createdAt: NOW,
        })),
      )
      .returning({ id: notification.id });
    await client.insert(pushDispatch).values(
      notifications.map(({ id }) => ({
        notificationId: id,
        userId,
        purpose: "TRANSACTIONAL" as const,
        status: "SENT" as const,
        scheduledAt: old,
        updatedAt: old,
      })),
    );

    // When
    await createPurge().execute();

    // Then
    expect(await remainingDispatchIds()).toEqual([]);
  });

  it("관리자 캠페인 발송은 30일이 지나도 남고 알림이 180일을 넘기면 알림과 함께 지워진다", async () => {
    // Given
    const expired = NOTIFICATION_CUTOFF.subtract(JUST_BEFORE);
    const kept = DISPATCH_CUTOFF.subtract({ hours: 24 });
    await insertDispatch(
      await insertNotification("지난 캠페인", expired, {
        type: "ADMIN_BROADCAST",
        campaignKey: BROADCAST_CAMPAIGN_KEY,
      }),
      "SENT",
      { scheduledAt: expired, updatedAt: expired },
      BROADCAST_CAMPAIGN_KEY,
    );
    const recentCampaign = await insertDispatch(
      await insertNotification("최근 캠페인", kept, {
        type: "ADMIN_BROADCAST",
        campaignKey: BROADCAST_CAMPAIGN_KEY,
      }),
      "SENT",
      { scheduledAt: kept, updatedAt: kept },
      BROADCAST_CAMPAIGN_KEY,
    );

    // When
    await createPurge().execute();

    // Then
    expect(await remainingDispatchIds()).toEqual([recentCampaign]);
    expect(await remainingTitles()).toEqual(["최근 캠페인"]);
  });

  it("한도 예약은 48시간 경계 직전만 지운다", async () => {
    // Given
    const notificationId = await insertNotification("최근 알림", NOW);
    const dispatchId = await insertDispatch(notificationId, "SENT", {
      scheduledAt: NOW,
      updatedAt: NOW,
    });
    await client.insert(pushRateLimitReservation).values([
      {
        dispatchId,
        phase: "GENERAL",
        userId,
        reservedAt: RESERVATION_CUTOFF.subtract(JUST_BEFORE),
      },
      { dispatchId, phase: "ENGAGEMENT", userId, reservedAt: RESERVATION_CUTOFF },
    ]);

    // When
    await createPurge().execute();

    // Then
    const remaining = await client
      .select({ phase: pushRateLimitReservation.phase })
      .from(pushRateLimitReservation);
    expect(remaining).toEqual([{ phase: "ENGAGEMENT" }]);
  });
});
