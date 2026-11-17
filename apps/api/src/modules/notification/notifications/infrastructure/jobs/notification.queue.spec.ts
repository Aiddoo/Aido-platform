import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_QUEUE,
  NotificationJobName,
  NotificationRuntimeJobSchema,
  PUSH_RECEIPTS_SCHEDULE_QUEUE,
} from "./notification.queue.js";

describe("알림 큐 계약", () => {
  it("queue 이름과 운영 정책을 기존 계약으로 유지한다", () => {
    // When
    const queue = NOTIFICATION_QUEUE;
    const deadLetterQueue = NOTIFICATION_DEAD_LETTER_QUEUE;
    const receiptsScheduleQueue = PUSH_RECEIPTS_SCHEDULE_QUEUE;

    // Then
    // 이름·재시도·DLQ·예약 key가 바뀌면 쌓인 작업과 스케줄을 잃는다
    expect(queue.name).toBe("notification.v1");
    expect(deadLetterQueue.name).toBe("notification-dead-letter.v1");
    expect(queue.retry).toEqual({
      retryLimit: 2,
      retryDelaySeconds: 1,
      retryBackoff: true,
      expireInSeconds: 300,
      retentionSeconds: 604_800,
      deleteAfterSeconds: 86_400,
    });
    expect(queue.deadLetter).toEqual({
      queue: "notification-dead-letter.v1",
      jobPolicy: {
        retryLimit: 0,
        retryDelaySeconds: 1,
        retryBackoff: true,
        expireInSeconds: 300,
        retentionSeconds: 1_209_600,
        deleteAfterSeconds: 1_209_600,
      },
    });
    expect(receiptsScheduleQueue).toMatchObject({
      name: "notification.v1",
      retry: queue.retry,
      schedules: [
        {
          key: "push-receipts-scheduler",
          cron: "*/5 * * * *",
          missed: "skip",
          payload: { name: NotificationJobName.PUSH_RECEIPTS, data: {} },
        },
      ],
    });
    expect(receiptsScheduleQueue.deadLetter).toBeUndefined();
  });

  it("job 이름과 payload의 상관관계를 런타임에도 검증한다", () => {
    // Given
    const followNew = {
      name: NotificationJobName.FOLLOW_NEW,
      data: { followerId: "follower-1", followingId: "following-1", followerName: "Aido" },
    };

    // When
    const matching = NotificationRuntimeJobSchema.safeParse(followNew);
    const mismatched = NotificationRuntimeJobSchema.safeParse({
      name: NotificationJobName.FOLLOW_NEW,
      data: { userId: "wrong-payload" },
    });

    // Then
    expect(matching.success).toBe(true);
    expect(mismatched.success).toBe(false);
  });
});
