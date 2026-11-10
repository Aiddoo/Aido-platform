import { RecordingAdminNotificationQueue } from "#test/doubles/operations/recording-admin-notification-queue";
import { StubSignupStatsReader } from "#test/doubles/operations/stub-signup-stats.reader";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { DispatchDailySignupSummaryUseCase } from "./dispatch-daily-signup-summary.use-case.js";

// 서울 2026-02-11 00:00
const KST_MIDNIGHT = Temporal.Instant.from("2026-02-10T15:00:00Z");

function setup() {
  const statsReader = new StubSignupStatsReader();
  const queue = new RecordingAdminNotificationQueue();
  const logger = new SilentLogger();
  const useCase = new DispatchDailySignupSummaryUseCase({
    statsReader,
    queue,
    clock: new FixedClock(KST_MIDNIGHT),
    logger,
  });
  return { useCase, statsReader, queue, logger };
}

describe("DispatchDailySignupSummaryUseCase — 일일 가입 요약", () => {
  it("전일(KST) 집계를 일반 메시지로 날짜 key와 함께 큐에 등록한다", async () => {
    // Given
    const { useCase, statsReader, queue } = setup();
    statsReader.result = {
      signupsByProvider: [
        { provider: "CREDENTIAL", count: 3 },
        { provider: "GOOGLE", count: 2 },
      ],
      totalUsers: 150,
    };

    // When
    await useCase.execute();

    // Then - 집계 기간은 전일 KST 00:00 ~ 당일 KST 00:00
    expect(statsReader.requests).toEqual([
      {
        start: Temporal.Instant.from("2026-02-09T15:00:00Z"),
        end: Temporal.Instant.from("2026-02-10T15:00:00Z"),
      },
    ]);
    expect(queue.sent).toEqual([
      {
        channel: "admin",
        options: { jobId: "signup-summary_2026-02-10" },
        notice: {
          type: "message",
          message: expect.objectContaining({
            title: "일일 가입 리포트 | 2026-02-10 (KST)",
            body: "전일 신규 가입은 5명입니다.\n\n가입 채널별\n- 이메일: 3명\n- Google: 2명",
          }),
        },
      },
    ]);
  });

  it("가입자가 없으면 0명이라고 적는다", async () => {
    // Given
    const { useCase, statsReader, queue } = setup();
    statsReader.result = { signupsByProvider: [], totalUsers: 100 };

    // When
    await useCase.execute();

    // Then
    const notice = queue.sent[0]?.notice;
    expect(notice?.type === "message" ? notice.message.body : null).toBe(
      "전일 신규 가입은 0명입니다.",
    );
  });

  it("집계 조회가 실패해도 예외를 전파하지 않고 원문 오류를 로그에 남기지 않는다", async () => {
    // Given
    const { useCase, statsReader, queue, logger } = setup();
    statsReader.result = new Error("synthetic-private-db-connection");

    // When
    await useCase.execute();

    // Then
    expect(queue.sent).toEqual([]);
    expect(logger.messages).toContainEqual({
      event: "operations.notifications.summary.failed",
      errorType: "summary-dispatch",
    });
    expect(JSON.stringify(logger.messages)).not.toContain("synthetic-private-db-connection");
  });

  it("큐 등록이 실패해도 예외를 전파하지 않는다", async () => {
    // Given
    const { useCase, queue } = setup();
    queue.failure = new Error("Queue error");

    // When
    const execution = useCase.execute();

    // Then
    await expect(execution).resolves.toBeUndefined();
  });
});
