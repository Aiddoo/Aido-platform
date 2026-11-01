import { eq } from "drizzle-orm";
import { assert } from "vitest";

import {
  NOTIFICATION_QUEUE,
  NotificationJobName,
} from "#api/modules/notification/infrastructure/jobs/delivery/notification-queue.constants";
import {
  RETENTION_QUEUE,
  RetentionJobName,
} from "#api/modules/notification/infrastructure/jobs/retention/retention-queue.constants";
import { retentionPushOutbox } from "#api/platform/database/schema/index";
import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";
import type { TestDatabaseClient } from "#test/setup/test-database";
import { createUserDatabaseFixture } from "#test/setup/user-database-fixture";

import {
  type CriticalQueueProcessorHarness,
  createCriticalQueueProcessorHarness,
} from "./helpers/critical-queue-processor.harness.js";

const JOB_OPTIONS: EnqueueJobOptions = {
  retryLimit: 1,
  retryDelaySeconds: 1,
  retryBackoff: false,
  expireInSeconds: 30,
  retentionSeconds: 60 * 60,
  deleteAfterSeconds: 60 * 60,
};

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
    const jobId = await harness.runtime.enqueue(
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
      { ...JOB_OPTIONS, idempotencyKey: `friend-completed:${friend.id}` },
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
        harness.boss.findJobs(NOTIFICATION_QUEUE, {
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

  it("retention-dispatch 잡은 실제 worker를 거쳐 전송 상태와 시도를 영속화한다", async () => {
    // Given
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
      startedAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    const stage = await findD1Stage(harness, recipient.id);
    await harness.retentionRepository.createDelivery({
      stageId: stage.id,
      userId: recipient.id,
      timezone: harness.daytimeTimezone,
      title: "오늘 할 일을 이어가세요",
      body: "작은 할 일 하나로 다시 시작해 보세요.",
      route: "/feed",
      variantId: "d1_return",
    });
    const outbox = await findOutbox(harness, stage.id);
    const publication = await claimReadyRetentionOutbox(harness, outbox.id);
    expect(publication).toEqual({ id: outbox.id, attempts: 1 });

    // When
    const jobId = await harness.runtime.enqueue(
      RETENTION_QUEUE,
      {
        name: RetentionJobName.DISPATCH,
        data: { outboxId: outbox.id, publishAttempt: publication?.attempts },
      },
      { ...JOB_OPTIONS, idempotencyKey: `retention-dispatch:${outbox.id}` },
    );
    if (publication) {
      await harness.retentionRepository.markOutboxPublished(publication);
    }

    // Then
    expect(jobId).not.toBeNull();
    await harness.eventually(async () => {
      const [dispatch, attempts, jobs] = await Promise.all([
        harness.client.query.pushDispatch.findFirst({ where: { id: outbox.dispatchId } }),
        harness.client.query.pushDeliveryAttempt.findMany({
          where: { dispatchId: outbox.dispatchId },
        }),
        harness.boss.findJobs(RETENTION_QUEUE, {
          id: jobId ?? undefined,
        }),
      ]);

      assert.exists(dispatch);
      expect(dispatch.status).toBe("SENT");
      expect(dispatch.sentAt).not.toBeNull();
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.status).toBe("TICKET_ACCEPTED");
      expect(jobs[0]?.state).toBe("completed");
    });
    expect(harness.pushProvider.getSentPayloads().map(({ token }) => token)).toEqual([
      "fake-retention-token",
    ]);
  });

  it("retention 잠금은 같은 잡의 더 높은 시도 횟수만 다시 가져가고 오래된 작업자의 마무리는 거부한다", async () => {
    // Given
    const { outbox, publication } = await createRetentionPublication(harness, "LEASE001");
    const first = await harness.retentionRepository.claimDispatch({
      outboxId: outbox.id,
      publishAttempt: publication.attempts,
      processingJobId: "retention-lease-job",
      processingJobAttempt: 1,
      startedAt: new Date(),
    });

    // When
    const other = await harness.retentionRepository.claimDispatch({
      outboxId: outbox.id,
      publishAttempt: publication.attempts,
      processingJobId: "different-job",
      processingJobAttempt: 2,
      startedAt: new Date(),
    });
    const retry = await harness.retentionRepository.claimDispatch({
      outboxId: outbox.id,
      publishAttempt: publication.attempts,
      processingJobId: "retention-lease-job",
      processingJobAttempt: 2,
      startedAt: new Date(),
    });

    // Then
    expect(first).not.toBeNull();
    expect(other).toBeNull();
    assert.exists(retry);
    expect(retry.fence.deliveryAttemptCount).toBe((first?.fence.deliveryAttemptCount ?? 0) + 1);
    await expect(
      harness.retentionRepository.markDispatchSkipped(first?.fence ?? retry.fence, "STALE"),
    ).resolves.toBe(false);
    await expect(
      harness.retentionRepository.markDispatchSkipped(retry.fence, "CURRENT"),
    ).resolves.toBe(true);
  });

  it("오래 멈춘 retention 처리 중 상태는 일반 outbox와 섞지 않고 발송 건과 retention outbox를 함께 다시 연다", async () => {
    // Given
    const { outbox, publication } = await createRetentionPublication(harness, "STALE001");
    await harness.retentionRepository.claimDispatch({
      outboxId: outbox.id,
      publishAttempt: publication.attempts,
      processingJobId: "stale-retention-job",
      processingJobAttempt: 1,
      startedAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    // When
    const recovered = await harness.retentionRepository.recoverStaleDispatches(
      new Date("2026-08-01T00:15:01.000Z"),
    );

    // Then
    expect(recovered).toBe(1);
    await expect(
      harness.client.query.pushDispatch.findFirst({ where: { id: outbox.dispatchId } }),
    ).resolves.toMatchObject({ status: "PENDING", processingJobId: null });
    await expect(
      harness.client.query.retentionPushOutbox.findFirst({ where: { id: outbox.id } }),
    ).resolves.toMatchObject({ status: "PENDING", publishedAt: null });
    await expect(
      harness.client.query.pushDispatchOutbox.findMany({
        where: { dispatchId: outbox.dispatchId },
      }),
    ).resolves.toHaveLength(0);
  });

  it("발행 표시가 늦어져도 실행 중인 retention 작업자의 잠금은 다시 열지 않는다", async () => {
    // Given
    const { outbox, publication } = await createRetentionPublication(harness, "ACTIVE01");
    const startedAt = new Date();
    await harness.retentionRepository.claimDispatch({
      outboxId: outbox.id,
      publishAttempt: publication.attempts,
      processingJobId: "active-retention-job",
      processingJobAttempt: 1,
      startedAt,
    });
    await harness.client
      .update(retentionPushOutbox)
      .set({
        status: "PROCESSING",
        publishedAt: null,
        lockedAt: new Date(startedAt.getTime() - 20 * 60_000),
      })
      .where(eq(retentionPushOutbox.id, outbox.id));

    // When
    const recovered = await harness.retentionRepository.recoverStaleOutboxes(
      new Date(startedAt.getTime() - 15 * 60_000),
    );

    // Then
    expect(recovered).toBe(0);
    await expect(
      harness.client.query.retentionPushOutbox.findFirst({ where: { id: outbox.id } }),
    ).resolves.toMatchObject({ status: "PROCESSING" });
  });

  it("retention 발송 한도 표시는 새 발행 회차에 남고 이전 회차의 실패 처리는 다시 열지 못한다", async () => {
    // Given
    const { outbox, publication } = await createRetentionPublication(harness, "RATE0001");
    const claimed = await harness.retentionRepository.claimDispatch({
      outboxId: outbox.id,
      publishAttempt: publication.attempts,
      processingJobId: "rate-reservation-job",
      processingJobAttempt: 1,
      startedAt: new Date(),
    });
    assert.exists(claimed);
    const reserved = await harness.retentionRepository.markRateLimitReserved(
      claimed.fence,
      new Date(),
    );
    const released = await harness.retentionRepository.releaseDispatchForRetry({
      fence: claimed.fence,
      reason: "provider unavailable",
      availableAt: new Date(),
      hasExhaustedRetries: false,
    });
    const [nextPublication] = await harness.retentionRepository.claimOutboxes(1, new Date());

    // When
    const reopened = await harness.retentionRepository.reopenUnclaimedDispatch({
      outboxId: outbox.id,
      publishAttempt: publication.attempts,
      availableAt: new Date(),
      reason: "stale DLQ",
    });
    const retry = await harness.retentionRepository.claimDispatch({
      outboxId: outbox.id,
      publishAttempt: nextPublication?.attempts,
      processingJobId: "rate-reservation-job-2",
      processingJobAttempt: 1,
      startedAt: new Date(),
    });

    // Then
    expect(reserved).toBe(true);
    expect(released).toBe(true);
    expect(nextPublication?.attempts).toBe(2);
    expect(reopened).toBe(false);
    expect(retry?.rateLimitReserved).toBe(true);
  });
});

async function createRetentionPublication(harness: CriticalQueueProcessorHarness, userTag: string) {
  const user = await createPushReadyUser(harness.client, {
    email: `${userTag.toLowerCase()}@example.com`,
    userTag,
    name: "Retention fixture",
    locale: "ko",
    token: `fake-${userTag.toLowerCase()}-token`,
    timezone: harness.daytimeTimezone,
  });
  await harness.retentionRepository.enroll({
    userId: user.id,
    variant: "TREATMENT",
    startedAt: new Date("2026-07-01T00:00:00.000Z"),
  });
  const stage = await findD1Stage(harness, user.id);
  await harness.retentionRepository.createDelivery({
    stageId: stage.id,
    userId: user.id,
    timezone: harness.daytimeTimezone,
    title: "title",
    body: "body",
    route: "/feed",
    variantId: "d1_return",
  });
  const outbox = await findOutbox(harness, stage.id);
  const publication = await claimReadyRetentionOutbox(harness, outbox.id);
  await harness.retentionRepository.markOutboxPublished(publication);
  return { outbox, publication };
}

async function findD1Stage(harness: CriticalQueueProcessorHarness, userId: string) {
  const stage = await harness.client.query.retentionExperimentStage.findFirst({
    where: { stage: "D1", assignment: { userId } },
  });
  assert.exists(stage);
  return stage;
}

async function findOutbox(harness: CriticalQueueProcessorHarness, stageId: string) {
  const outbox = await harness.client.query.retentionPushOutbox.findFirst({ where: { stageId } });
  assert.exists(outbox);
  return outbox;
}

async function claimReadyRetentionOutbox(harness: CriticalQueueProcessorHarness, outboxId: string) {
  const claimAt = new Date("2026-07-02T00:00:00.000Z");
  await harness.client
    .update(retentionPushOutbox)
    .set({ availableAt: claimAt })
    .where(eq(retentionPushOutbox.id, outboxId));
  const [publication] = await harness.retentionRepository.claimOutboxes(1, claimAt);
  if (publication === undefined) {
    throw new Error("준비한 Retention outbox를 claim하지 못했습니다.");
  }
  return publication;
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
      consent: { marketingPushAgreedAt: new Date("2026-07-01T00:00:00.000Z") },
      pushTokens: {
        token: input.token,
        deviceId: `${input.userTag}-device`,
        platform: "IOS",
        appVersion: "1.8.0",
      },
    },
  );
}
