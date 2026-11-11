import {
  InMemoryPushDeliveryOutboxRepository,
  type InMemoryPushDeliveryOutboxRow,
} from "#test/doubles/notification/in-memory-push-delivery-outbox.repository";
import { RecordingPushDeliveryJobEnqueuer } from "#test/doubles/notification/recording-push-delivery-job-enqueuer";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import { PublishPushDeliveryOutboxUseCase } from "./publish-push-delivery-outbox.use-case.js";

const NOW = Temporal.Instant.from("2026-08-29T00:00:00.000Z");

function createPublishUseCase(rows: readonly InMemoryPushDeliveryOutboxRow[]) {
  const outbox = new InMemoryPushDeliveryOutboxRepository(rows);
  const enqueuer = new RecordingPushDeliveryJobEnqueuer();
  const logger = new SilentLogger();
  const useCase = new PublishPushDeliveryOutboxUseCase({
    outbox,
    enqueuer,
    unitOfWork: new ImmediateUnitOfWork(),
    clock: new FixedClock(NOW),
    logger,
  });
  return { outbox, enqueuer, logger, useCase };
}

describe("PublishPushDeliveryOutboxUseCase — outbox job 발행", () => {
  it("available relay는 한 job의 최대 100건만 claim하고 발행 완료 수를 반환한다", async () => {
    // Given
    const rows = Array.from({ length: 101 }, (_, index) =>
      InMemoryPushDeliveryOutboxRepository.pending(index + 1),
    );
    const { outbox, enqueuer, useCase } = createPublishUseCase(rows);

    // When
    const publishedCount = await useCase.execute({ kind: "available", limit: 500 });

    // Then
    expect(publishedCount).toBe(100);
    expect(enqueuer.jobs).toHaveLength(1);
    expect(enqueuer.jobs[0]?.lane).toBe("TRANSACTIONAL");
    expect(enqueuer.jobs[0]?.publications).toHaveLength(100);
    expect(enqueuer.jobs[0]?.publications[0]).toEqual({ dispatchId: 1, publishAttempt: 1 });
    expect(outbox.rowOf(1)?.status).toBe("PUBLISHED");
    expect(outbox.rowOf(101)?.status).toBe("PENDING");
  });

  it("지정 dispatch가 비어 있으면 아무것도 claim·발행하지 않는다", async () => {
    // Given
    const { outbox, enqueuer, useCase } = createPublishUseCase([
      InMemoryPushDeliveryOutboxRepository.pending(31),
    ]);

    // When
    const publishedCount = await useCase.execute({ kind: "dispatches", dispatchIds: [] });

    // Then
    expect(publishedCount).toBe(0);
    expect(enqueuer.jobs).toEqual([]);
    expect(outbox.rowOf(31)?.status).toBe("PENDING");
  });

  it("enqueue가 거부되면 같은 generation을 backoff 시점까지 defer한다", async () => {
    // Given - 두 번째 generation을 claim한 뒤 queue backend가 enqueue를 거부
    const { outbox, enqueuer, logger, useCase } = createPublishUseCase([
      InMemoryPushDeliveryOutboxRepository.pending(41, { publishAttempts: 1 }),
    ]);
    enqueuer.rejection = { reason: new Error("queue unavailable") };

    // When
    const publishedCount = await useCase.execute({ kind: "dispatches", dispatchIds: [41] });

    // Then - capped backoff로 PENDING 복구하고 published로 표시하지 않음
    expect(publishedCount).toBe(0);
    expect(outbox.rowOf(41)).toMatchObject({
      status: "PENDING",
      publishAttempts: 2,
      availableAt: NOW.add({ milliseconds: 2000 }),
      lastError: "queue unavailable",
    });
    expect(logger.messages).toContainEqual(
      expect.objectContaining({
        event: NotificationDeliveryLogEvent.PUBLISH_PUSH_DELIVERY_OUTBOX_ENQUEUE_DEFERRED,
      }),
    );
  });

  it("queue가 문자열 오류를 반환해도 안전한 메시지로 정규화해 defer한다", async () => {
    // Given
    const { outbox, enqueuer, useCase } = createPublishUseCase([
      InMemoryPushDeliveryOutboxRepository.pending(42),
    ]);
    enqueuer.rejection = { reason: "queue unavailable" };

    // When
    await useCase.execute({ kind: "dispatches", dispatchIds: [42] });

    // Then
    expect(outbox.rowOf(42)).toMatchObject({ status: "PENDING", lastError: "queue unavailable" });
  });

  it("enqueue 성공 뒤 publish mark가 실패하면 generation을 defer하지 않는다", async () => {
    // Given - queue가 job을 수락했지만 publish mark 저장이 일시적으로 실패
    const { outbox, enqueuer, useCase } = createPublishUseCase([
      InMemoryPushDeliveryOutboxRepository.pending(52, { publishAttempts: 2 }),
    ]);
    outbox.markPublishedError = new Error("commit uncertain");

    // When
    const publishedCount = await useCase.execute({ kind: "dispatches", dispatchIds: [52] });

    // Then - 이미 enqueue된 generation은 lease recovery에 맡기고 되돌리지 않음
    expect(publishedCount).toBe(0);
    expect(enqueuer.jobs).toEqual([
      { publications: [{ dispatchId: 52, publishAttempt: 3 }], lane: "TRANSACTIONAL" },
    ]);
    expect(outbox.rowOf(52)).toMatchObject({
      status: "PROCESSING",
      publishAttempts: 3,
      lockedAt: NOW,
      lastError: null,
    });
  });

  it("거래성과 마케팅 publication은 차선별 작업으로 나눠 발행하고 key 입력에는 차선을 싣지 않는다", async () => {
    // Given - 한 claim에 두 차선이 섞여 있다
    const { enqueuer, useCase } = createPublishUseCase([
      InMemoryPushDeliveryOutboxRepository.pending(61, { lane: "MARKETING" }),
      InMemoryPushDeliveryOutboxRepository.pending(62, { lane: "TRANSACTIONAL" }),
      InMemoryPushDeliveryOutboxRepository.pending(63, { lane: "MARKETING", publishAttempts: 1 }),
    ]);

    // When
    const publishedCount = await useCase.execute({ kind: "available", limit: 100 });

    // Then - 거래성 작업을 먼저 넣고 각 작업은 한 차선만 담는다
    expect(publishedCount).toBe(3);
    expect(enqueuer.jobs).toEqual([
      { publications: [{ dispatchId: 62, publishAttempt: 1 }], lane: "TRANSACTIONAL" },
      {
        publications: [
          { dispatchId: 61, publishAttempt: 1 },
          { dispatchId: 63, publishAttempt: 2 },
        ],
        lane: "MARKETING",
      },
    ]);
  });
});
