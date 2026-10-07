import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { DispatchDailySignupSummary } from "./dispatch-daily-signup-summary.use-case.js";

describe("DispatchDailySignupSummary", () => {
  let useCase: DispatchDailySignupSummary;
  let reader: Mocked<ConstructorParameters<typeof DispatchDailySignupSummary>[0]["reader"]>;
  let queue: Mocked<ConstructorParameters<typeof DispatchDailySignupSummary>[0]["queue"]>;

  let logger: Mocked<ConstructorParameters<typeof DispatchDailySignupSummary>[0]["logger"]>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    const dispatchDailySignupSummaryDependencies = mockDeep<
      ConstructorParameters<typeof DispatchDailySignupSummary>[0]
    >({});
    const unit = new DispatchDailySignupSummary(dispatchDailySignupSummaryDependencies);
    logger = dispatchDailySignupSummaryDependencies.logger;
    useCase = unit;
    reader = dispatchDailySignupSummaryDependencies.reader;
    queue = dispatchDailySignupSummaryDependencies.queue;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** enqueueSend 호출의 notification 인자 추출 */
  function getNotification() {
    return queue.enqueueSend.mock.calls[0]?.[1];
  }

  it("일일 가입 요약을 큐에 등록한다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
    reader.getSignupStats.mockResolvedValue({
      signupsByProvider: [
        { provider: "CREDENTIAL", count: 3 },
        { provider: "GOOGLE", count: 2 },
      ],
      totalUsers: 150,
    });

    // When
    await useCase.execute();

    // Then — 집계 기간(전일 KST)
    expect(reader.getSignupStats).toHaveBeenCalledWith(
      new Date("2026-02-09T15:00:00.000Z"),
      new Date("2026-02-10T15:00:00.000Z"),
    );

    // Then — 큐 등록 메시지 + jobId
    expect(queue.enqueueSend).toHaveBeenCalledWith(
      "admin",
      expect.objectContaining({
        title: "일일 가입 리포트 | 2026-02-10 (KST)",
        body: "전일 신규 가입은 5명입니다.\n\n가입 채널별\n- 이메일: 3명\n- Google: 2명",
        fields: expect.arrayContaining([
          expect.objectContaining({ name: "전일 신규 가입", value: "5명" }),
          expect.objectContaining({
            name: "집계 기준",
            value: "2026-02-10 00:00 ~ 23:59 (KST)",
          }),
        ]),
      }),
      expect.objectContaining({ jobId: "signup-summary_2026-02-10" }),
    );
  });

  it("가입자가 없으면 해당 메시지를 표시한다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
    reader.getSignupStats.mockResolvedValue({
      signupsByProvider: [],
      totalUsers: 100,
    });

    // When
    await useCase.execute();

    // Then
    const notification = getNotification();
    expect(notification?.body).toBe("전일 신규 가입은 0명입니다.");
    expect(notification?.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "전일 신규 가입", value: "0명" })]),
    );
  });

  it("집계 DB 에러가 발생해도 예외가 전파되지 않는다", async () => {
    // Given
    reader.getSignupStats.mockRejectedValue(new Error("synthetic-private-db-connection"));

    // When & Then
    await expect(useCase.execute()).resolves.not.toThrow();
    expect(queue.enqueueSend).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: expect.any(String),
      errorType: "summary-dispatch",
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      "synthetic-private-db-connection",
    );
  });

  it("큐 등록 실패해도 예외가 전파되지 않는다", async () => {
    // Given
    vi.setSystemTime(new Date("2026-02-11T00:00:00+09:00"));
    reader.getSignupStats.mockResolvedValue({
      signupsByProvider: [],
      totalUsers: 100,
    });
    queue.enqueueSend.mockRejectedValue(new Error("Queue error"));

    // When & Then
    await expect(useCase.execute()).resolves.not.toThrow();
  });
});
