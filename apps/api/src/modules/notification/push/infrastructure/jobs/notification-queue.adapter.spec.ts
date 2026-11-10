import { Logger } from "@nestjs/common";

import type { EnqueueOptions, QueueDefinition } from "#api/shared/application/ports/index";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { NotificationQueueAdapter } from "./notification-queue.adapter.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_QUEUE,
  NotificationJobName,
} from "./notification.queue.js";

class FlakyJobQueue extends InMemoryJobQueue {
  failuresLeft: number;
  readonly failure: Error;

  constructor(failures: number, failure = new Error("connection reset")) {
    super();
    this.failuresLeft = failures;
    this.failure = failure;
  }

  override async enqueue<TPayload extends object>(
    queue: QueueDefinition<TPayload>,
    payload: TPayload,
    options?: EnqueueOptions,
  ): Promise<string | null> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw this.failure;
    }
    return super.enqueue(queue, payload, options);
  }
}

const nudge = {
  nudgeId: 7,
  senderId: "sender",
  receiverId: "receiver",
  senderName: "보낸 사람",
};

const clock = new FixedClock(Temporal.Instant.from("2026-11-03T15:30:00Z"));

describe("NotificationQueueAdapter — 알림 이벤트 등록", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("원인 이벤트별 key와 DLQ 정의로 등록해 같은 이벤트의 재발행만 하나로 합친다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const service = new NotificationQueueAdapter(jobQueue, clock);

    // When
    service.enqueueNudgeSent(nudge);
    service.enqueueNudgeSent(nudge);
    service.enqueueNudgeSent({ ...nudge, nudgeId: 8 });
    await service.onModuleDestroy();

    // Then
    expect(
      jobQueue.jobsIn(NOTIFICATION_QUEUE).map(({ options }) => options.idempotencyKey),
    ).toEqual(["nudge-7", "nudge-8"]);
    expect(jobQueue.jobsIn(NOTIFICATION_QUEUE)[0]?.payload).toEqual({
      name: NotificationJobName.NUDGE_SENT,
      data: nudge,
    });
    expect(NOTIFICATION_QUEUE.deadLetter).toMatchObject({
      queue: NOTIFICATION_DEAD_LETTER_QUEUE.name,
    });
  });

  it("날짜가 들어간 key는 시계의 발생 시각으로 만든다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const service = new NotificationQueueAdapter(jobQueue, clock);

    // When: UTC 15:30은 서울 다음 날 00:30이다
    service.enqueueFriendCompleted({
      friendId: "f",
      friendName: "F",
      notifyUserIds: ["u"],
      timezone: "Asia/Seoul",
    });
    await service.onModuleDestroy();

    // Then
    expect(jobQueue.jobsIn(NOTIFICATION_QUEUE)[0]?.options.idempotencyKey).toBe(
      "friend-completed-f-2026-11-04",
    );
  });

  it("일시적인 저장 실패는 다시 시도해 등록한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const jobQueue = new FlakyJobQueue(2);
    const service = new NotificationQueueAdapter(jobQueue, clock);

    // When
    service.enqueueCheerSent({
      cheerId: 3,
      senderId: "s",
      receiverId: "r",
      senderName: "응원한 사람",
    });
    await vi.runAllTimersAsync();
    await service.onModuleDestroy();

    // Then
    expect(
      jobQueue.jobsIn(NOTIFICATION_QUEUE).map(({ options }) => options.idempotencyKey),
    ).toEqual(["cheer-3"]);
  });

  it("재시도까지 실패하면 호출자에게 던지지 않고 작업 이름과 오류 종류만 기록한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const privateMessage = "private-token-and-body";
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const jobQueue = new FlakyJobQueue(Number.POSITIVE_INFINITY, new Error(privateMessage));
    const service = new NotificationQueueAdapter(jobQueue, clock);

    // When
    service.enqueueNudgeSent(nudge);
    await vi.runAllTimersAsync();
    await service.onModuleDestroy();

    // Then
    expect(jobQueue.jobs).toHaveLength(0);
    expect(error).toHaveBeenCalledWith({
      event: "notification.enqueue_failed",
      jobName: NotificationJobName.NUDGE_SENT,
      errorType: "Error",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain(privateMessage);
  });

  it("결제 문제 알림은 호출자의 트랜잭션에 기록하고 실패를 호출자에게 던진다", async () => {
    // Given
    const jobQueue = new FlakyJobQueue(Number.POSITIVE_INFINITY, new Error("db down"));
    const service = new NotificationQueueAdapter(jobQueue, clock);

    // When
    const recording = service.enqueueBillingIssue(
      { userId: "user-1" },
      Temporal.Instant.from("2026-11-03T00:00:00.000Z"),
    );

    // Then
    await expect(recording).rejects.toThrow("db down");
  });
});
