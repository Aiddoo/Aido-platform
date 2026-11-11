import { RETENTION_QUEUE, RetentionJobName } from "./retention.queue.js";

describe("리텐션 큐 계약", () => {
  it("queue 이름·재시도·예약 key를 기존 계약으로 유지하고 sweep을 매분 예약한다", () => {
    // Given / When / Then: 이름·예약 key가 바뀌면 쌓인 작업과 기존 예약을 잃는다
    expect(RETENTION_QUEUE).toMatchObject({
      name: "retention.v1",
      retry: {
        retryLimit: 4,
        retryDelaySeconds: 1,
        retryBackoff: true,
        expireInSeconds: 300,
        retentionSeconds: 604_800,
        deleteAfterSeconds: 86_400,
      },
      worker: { localConcurrency: 1, pollingIntervalSeconds: 15 },
      schedules: [
        {
          key: "retention-stage-sweep-scheduler",
          cron: "* * * * *",
          missed: "once",
          payload: { name: RetentionJobName.STAGE_SWEEP, data: {} },
        },
      ],
    });
  });

  it("이전 배포의 발송 작업 payload도 읽고 모르는 작업은 거부한다", () => {
    // Given
    const schema = RETENTION_QUEUE.payloadSchema;

    // When / Then
    expect(
      schema.safeParse({
        name: "retention-dispatch",
        data: { outboxId: "outbox-1", publishAttempt: 2 },
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ name: RetentionJobName.STAGE_SWEEP, data: {} }).success).toBe(true);
    expect(schema.safeParse({ name: RetentionJobName.STAGE_SWEEP, data: { x: 1 } }).success).toBe(
      false,
    );
    expect(schema.safeParse({ name: "unknown", data: {} }).success).toBe(false);
  });
});
