import { Logger } from "@nestjs/common";

import type { EnqueueJobOptions, JobData } from "#api/shared/application/ports/job-runtime.port";
import { FakeJobRuntime } from "#test/mocks/fake-job-runtime";

import { NotificationQueueAdapter } from "./notification-queue.adapter.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_QUEUE,
  NotificationJobName,
} from "./notification-queue.constants.js";

class FlakyJobRuntime extends FakeJobRuntime {
  failuresLeft: number;
  readonly failure: Error;

  constructor(failures: number, failure = new Error("connection reset")) {
    super();
    this.failuresLeft = failures;
    this.failure = failure;
  }

  override async enqueue<T extends JobData>(
    queue: string,
    data: T,
    options: EnqueueJobOptions,
  ): Promise<string | null> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw this.failure;
    }
    return super.enqueue(queue, data, options);
  }
}

const nudge = {
  nudgeId: 7,
  senderId: "sender",
  receiverId: "receiver",
  senderName: "보낸 사람",
};

describe("NotificationQueueAdapter — 알림 이벤트 등록", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("원인 이벤트별 key와 DLQ 정책으로 등록해 같은 이벤트의 재발행만 하나로 합친다", async () => {
    // Given
    const runtime = new FakeJobRuntime();
    const service = new NotificationQueueAdapter(runtime);

    // When
    service.enqueueNudgeSent(nudge);
    service.enqueueNudgeSent(nudge);
    service.enqueueNudgeSent({ ...nudge, nudgeId: 8 });
    await service.onModuleDestroy();

    // Then
    expect(runtime.enqueueCalls.map(({ options }) => options.idempotencyKey)).toEqual([
      "nudge-7",
      "nudge-8",
    ]);
    expect(runtime.enqueueCalls[0]).toMatchObject({
      queue: NOTIFICATION_QUEUE,
      data: { name: NotificationJobName.NUDGE_SENT, data: nudge },
      options: { deadLetter: { queue: NOTIFICATION_DEAD_LETTER_QUEUE } },
    });
  });

  it("일시적인 저장 실패는 다시 시도해 등록한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const runtime = new FlakyJobRuntime(2);
    const service = new NotificationQueueAdapter(runtime);

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
    expect(runtime.enqueueCalls.map(({ options }) => options.idempotencyKey)).toEqual(["cheer-3"]);
  });

  it("재시도까지 실패하면 호출자에게 던지지 않고 작업 이름과 오류 종류만 기록한다", async () => {
    // Given
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const privateMessage = "private-token-and-body";
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const runtime = new FlakyJobRuntime(Number.POSITIVE_INFINITY, new Error(privateMessage));
    const service = new NotificationQueueAdapter(runtime);

    // When
    service.enqueueNudgeSent(nudge);
    await vi.runAllTimersAsync();
    await service.onModuleDestroy();

    // Then
    expect(runtime.enqueueCalls).toHaveLength(0);
    expect(error).toHaveBeenCalledWith({
      event: "notification.enqueue_failed",
      jobName: NotificationJobName.NUDGE_SENT,
      errorType: "Error",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain(privateMessage);
  });

  it("결제 문제 알림은 호출자의 트랜잭션에 기록하고 실패를 호출자에게 던진다", async () => {
    // Given
    const runtime = new FlakyJobRuntime(Number.POSITIVE_INFINITY, new Error("db down"));
    const service = new NotificationQueueAdapter(runtime);

    // When
    const recording = service.enqueueBillingIssue({ userId: "user-1" }, new Date());

    // Then
    await expect(recording).rejects.toThrow("db down");
  });
});
