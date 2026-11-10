import { eq } from "drizzle-orm";
import { chunk } from "es-toolkit";
import { assert } from "vitest";

import { PublishNotificationUseCase } from "#api/modules/notification/push/application/use-cases/publish-notification.use-case";
import {
  NOTIFICATION_QUEUE,
  NotificationJobName,
} from "#api/modules/notification/push/infrastructure/jobs/notification.queue";
import { PushDeliveryQueueProcessor } from "#api/modules/notification/push/infrastructure/jobs/push-delivery-queue.processor";
import {
  PUSH_DELIVERY_QUEUE,
  PushDeliveryRuntimeJobSchema,
} from "#api/modules/notification/push/infrastructure/jobs/push-delivery.queue";
import {
  RETENTION_QUEUE,
  RetentionJobName,
} from "#api/modules/notification/retention/infrastructure/jobs/retention.queue";
import { CreateBroadcastCampaignUseCase } from "#api/modules/operations/broadcasts/application/use-cases/create-broadcast-campaign.use-case";
import { BROADCAST_FAN_OUT_QUEUE } from "#api/modules/operations/broadcasts/infrastructure/jobs/broadcast-fan-out.queue";
import { pushDispatch, pushToken, user, userPreference } from "#api/platform/database/schema/index";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import {
  type CriticalQueueProcessorHarness,
  createCriticalQueueProcessorHarness,
} from "./helpers/critical-queue-processor.harness.js";

const BROADCAST_TIMEOUT_MS = 180_000;
/** retention worker는 정해진 시각 작업이라 15초마다 polling한다. */
const SCHEDULED_WORKER_TIMEOUT_MS = 40_000;

describe("핵심 큐 프로세서 컴포넌트 테스트 (실제 PostgreSQL + pg-boss)", () => {
  let harness: CriticalQueueProcessorHarness;

  beforeAll(async () => {
    harness = await createCriticalQueueProcessorHarness();
  }, 60_000);

  beforeEach(async () => {
    await harness.cleanup();
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("friend-completed 잡은 실제 worker를 거쳐 알림과 푸시 전달 결과를 영속화한다", async () => {
    // Given
    const friend = await createPushReadyUser(harness.client, {
      email: "queue-friend@example.com",
      userTag: "FRIEND01",
      name: "완료 친구",
      locale: "ko",
      token: "fake-friend-token",
    });
    const koreanRecipient = await createPushReadyUser(harness.client, {
      email: "queue-ko@example.com",
      userTag: "QUEUEKO1",
      name: "한국어 수신자",
      locale: "ko",
      token: "fake-queue-ko-token",
    });
    const englishRecipient = await createPushReadyUser(harness.client, {
      email: "queue-en@example.com",
      userTag: "QUEUEEN1",
      name: "English recipient",
      locale: "en",
      token: "fake-queue-en-token",
    });

    // When
    const jobId = await harness.jobQueue.enqueue(
      NOTIFICATION_QUEUE,
      {
        name: NotificationJobName.FRIEND_COMPLETED,
        data: {
          friendId: friend.id,
          friendName: "완료 친구",
          notifyUserIds: [koreanRecipient.id, englishRecipient.id],
          timezone: "Asia/Seoul",
        },
      },
      { idempotencyKey: `friend-completed:${friend.id}` },
    );

    // Then
    expect(jobId).not.toBeNull();
    await harness.eventually(async () => {
      const friendCompleted = { type: "FRIEND_COMPLETED" as const, friendId: friend.id };
      const [notifications, dispatches, attempts, jobs] = await Promise.all([
        harness.client.query.notification.findMany({
          where: friendCompleted,
          orderBy: { userId: "asc" },
        }),
        harness.client.query.pushDispatch.findMany({ where: { notification: friendCompleted } }),
        harness.client.query.pushDeliveryAttempt.findMany({
          where: { dispatch: { notification: friendCompleted } },
        }),
        harness.boss.findJobs(NOTIFICATION_QUEUE.name, {
          id: jobId ?? undefined,
        }),
      ]);

      expect(notifications).toHaveLength(2);
      expect(notifications.map(({ userId }) => userId).sort()).toEqual(
        [koreanRecipient.id, englishRecipient.id].sort(),
      );
      expect(notifications.every(({ notificationDate }) => notificationDate !== null)).toBe(true);
      expect(dispatches).toHaveLength(2);
      expect(dispatches.every(({ status }) => status === "SENT")).toBe(true);
      expect(attempts).toHaveLength(2);
      expect(attempts.every(({ status }) => status === "TICKET_ACCEPTED")).toBe(true);
      expect(jobs[0]?.state).toBe("completed");
    });
    expect(
      harness.pushProvider
        .getSentPayloads()
        .map(({ token }) => token)
        .sort(),
    ).toEqual(["fake-queue-en-token", "fake-queue-ko-token"]);
  });

  it("거래성 푸시는 우선순위 10, 마케팅 푸시는 0으로 발송 작업에 오르고 같은 작업을 다시 처리해도 한 번만 보낸다", async () => {
    // Given
    const recipient = await createPushReadyUser(harness.client, {
      email: "queue-lane@example.com",
      userTag: "QLANE001",
      name: "차선 수신자",
      locale: "ko",
      token: "fake-lane-token",
      timezone: harness.daytimeTimezone,
    });
    const publisher = harness.module.get(PublishNotificationUseCase);

    // When
    await publisher.publish({
      userId: recipient.id,
      type: "SYSTEM_NOTICE",
      title: "결제 확인",
      body: "결제 수단을 확인해 주세요",
    });
    await publisher.publish({
      userId: recipient.id,
      type: "SYSTEM_NOTICE",
      title: "새 기능",
      body: "새 기능을 써 보세요",
      purpose: "ENGAGEMENT",
    });

    // Then
    let deliveryJobs: Awaited<ReturnType<typeof harness.boss.findJobs>> = [];
    await harness.eventually(async () => {
      const dispatches = await harness.client.query.pushDispatch.findMany({
        where: { userId: recipient.id },
      });
      expect(dispatches.map(({ status }) => status)).toEqual(["SENT", "SENT"]);
      deliveryJobs = (await harness.boss.findJobs(PUSH_DELIVERY_QUEUE.name)).filter(
        (job) =>
          job.state === "completed" &&
          PushDeliveryRuntimeJobSchema.safeParse(job.data).data?.name === "deliver-dispatches",
      );
      expect(deliveryJobs).toHaveLength(2);
    });
    expect(deliveryJobs.map(({ priority }) => priority).sort()).toEqual([0, 10]);
    expect(harness.pushProvider.getSentPayloads()).toHaveLength(2);

    // When: at-least-once 재전달처럼 끝난 작업을 같은 id·attempt로 다시 처리한다
    const processor = harness.module.get(PushDeliveryQueueProcessor);
    for (const job of deliveryJobs) {
      const payload = PushDeliveryRuntimeJobSchema.parse(job.data);
      await processor.process(job.id, job.retryCount + 1, payload);
      await processor.process(job.id, job.retryCount + 2, payload);
    }

    // Then: dispatch 상태 fence가 다시 claim하지 않아 기기마다 한 번만 보낸다
    expect(harness.pushProvider.getSentPayloads()).toHaveLength(2);
    await expect(
      harness.client.query.pushDeliveryAttempt.findMany({
        where: { dispatch: { userId: recipient.id } },
      }),
    ).resolves.toHaveLength(2);
  });

  it(
    "retention sweep 잡은 공용 outbox와 push-delivery worker로 ENGAGEMENT 푸시를 보낸다",
    async () => {
      // Given: 가입 3시간 뒤 할 일이 없는 D0 대상
      const recipient = await createPushReadyUser(harness.client, {
        email: "queue-retention@example.com",
        userTag: "RETENT01",
        name: "리텐션 수신자",
        locale: "ko",
        token: "fake-retention-token",
        timezone: harness.daytimeTimezone,
      });
      await harness.retentionRepository.enroll({
        userId: recipient.id,
        variant: "TREATMENT",
        startedAt: Temporal.Instant.fromEpochMilliseconds(Date.now() - 3 * 60 * 60 * 1000),
      });

      // When
      await harness.jobQueue.enqueue(
        RETENTION_QUEUE,
        { name: RetentionJobName.STAGE_SWEEP, data: {} },
        { idempotencyKey: `retention-sweep:${recipient.id}` },
      );

      // Then
      await harness.eventually(async () => {
        const dispatch = await harness.client.query.pushDispatch.findFirst({
          where: { userId: recipient.id },
          with: { notification: true },
        });
        assert.exists(dispatch);
        expect(dispatch).toMatchObject({ status: "SENT", purpose: "ENGAGEMENT" });
        const stage = await harness.client.query.retentionExperimentStage.findFirst({
          where: { stage: "D0", assignment: { userId: recipient.id } },
        });
        expect(stage).toMatchObject({
          status: "OUTBOXED",
          notificationId: dispatch.notificationId,
        });
      }, SCHEDULED_WORKER_TIMEOUT_MS);
      expect(harness.pushProvider.getSentPayloads()).toEqual([
        expect.objectContaining({
          token: "fake-retention-token",
          categoryId: "MARKETING",
          data: expect.objectContaining({ purpose: "ENGAGEMENT", type: "SYSTEM_NOTICE" }),
        }),
      ]);
    },
    SCHEDULED_WORKER_TIMEOUT_MS + 10_000,
  );

  it(
    "브로드캐스트는 같은 요청을 한 번만 분배하고 대상 전원에게 발송한다",
    async () => {
      // Given
      const recipientCount = Number(process.env.BROADCAST_RECIPIENT_COUNT ?? 1_200);
      await seedPushReadyUsers(harness.client, recipientCount);
      const createCampaign = harness.module.get(CreateBroadcastCampaignUseCase);
      const request = {
        requestId: "7d3a3f6e-3a0c-4b8e-9d0f-0d6a3c2b1a90",
        title: "새 기능 안내",
        body: "지금 확인해 보세요.",
        targetFilter: "WITH_PUSH_TOKEN",
        force: true,
      } as const;
      const startedAt = performance.now();

      // When
      const [first, replay] = await Promise.all([
        createCampaign.execute(request),
        createCampaign.execute(request),
      ]);

      // Then
      expect(replay.campaign.id.value).toBe(first.campaign.id.value);
      await harness.eventually(async () => {
        const [campaign, sentDispatches] = await Promise.all([
          harness.client.query.broadcastCampaign.findFirst({
            where: { id: first.campaign.id.value },
          }),
          harness.client.$count(pushDispatch, eq(pushDispatch.status, "SENT")),
        ]);
        expect(campaign).toMatchObject({
          status: "COMPLETED",
          processedCount: recipientCount,
          queuedCount: recipientCount,
        });
        expect(sentDispatches).toBe(recipientCount);
      }, BROADCAST_TIMEOUT_MS);
      const elapsedMs = Math.round(performance.now() - startedAt);
      const fanOutJobs = await harness.boss.findJobs(BROADCAST_FAN_OUT_QUEUE.name);
      expect(new Set(harness.pushProvider.getSentPayloads().map(({ token }) => token)).size).toBe(
        recipientCount,
      );
      expect(fanOutJobs.every(({ state }) => state === "completed")).toBe(true);
      process.stderr.write(
        `${JSON.stringify({
          event: "broadcast.measured",
          recipientCount,
          elapsedMs,
          fanOutJobs: fanOutJobs.length,
        })}\n`,
      );
    },
    BROADCAST_TIMEOUT_MS + 30_000,
  );
});

async function seedPushReadyUsers(client: TestDatabaseClient, count: number): Promise<void> {
  for (const page of chunk(
    Array.from({ length: count }, (_, index) => index),
    1_000,
  )) {
    const users = await client
      .insert(user)
      .values(
        page.map((index) => ({
          email: `broadcast-${index}@example.com`,
          userTag: `B${String(index).padStart(7, "0")}`,
          status: "ACTIVE" as const,
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
        })),
      )
      .returning({ id: user.id });
    await client
      .insert(userPreference)
      .values(users.map(({ id }) => ({ userId: id, pushEnabled: true, nightPushEnabled: true })));
    await client.insert(pushToken).values(
      users.map(({ id }) => ({
        userId: id,
        token: `fake-broadcast-${id}`,
        deviceId: `broadcast-device-${id}`,
        platform: "IOS" as const,
        updatedAt: Temporal.Now.instant(),
      })),
    );
  }
}

async function createPushReadyUser(
  client: TestDatabaseClient,
  input: {
    email: string;
    userTag: string;
    name: string;
    locale: "ko" | "en";
    token: string;
    timezone?: string;
  },
): Promise<{ id: string }> {
  return createUserDatabaseFixture(
    client,
    { email: input.email, userTag: input.userTag, status: "ACTIVE" },
    {
      profile: { name: input.name },
      preference: {
        pushEnabled: true,
        nightPushEnabled: true,
        timezone: input.timezone ?? "Asia/Seoul",
        locale: input.locale,
      },
      consent: { marketingPushAgreedAt: Temporal.Instant.from("2026-07-01T00:00:00.000Z") },
      pushTokens: {
        token: input.token,
        deviceId: `${input.userTag}-device`,
        platform: "IOS",
        appVersion: "1.8.0",
        updatedAt: Temporal.Now.instant(),
      },
    },
  );
}
