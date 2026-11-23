import {
  JOB_BACKLOG_WARNING_SIZE,
  JOB_POLLING_SECONDS,
  resolveBacklogWarningSize,
} from "./job-queue.port.js";

describe("큐 대기 경고 기준", () => {
  it.each([
    { pollingIntervalSeconds: 0.5, expected: JOB_BACKLOG_WARNING_SIZE.INTERACTIVE },
    {
      pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
      expected: JOB_BACKLOG_WARNING_SIZE.INTERACTIVE,
    },
    {
      pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
      expected: JOB_BACKLOG_WARNING_SIZE.SCHEDULED,
    },
    {
      pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
      expected: JOB_BACKLOG_WARNING_SIZE.BACKGROUND,
    },
  ])(
    "정의에 없으면 $pollingIntervalSeconds초 폴링 종류의 기본값이다",
    ({ pollingIntervalSeconds, expected }) => {
      // When
      const size = resolveBacklogWarningSize({
        worker: { localConcurrency: 1, pollingIntervalSeconds },
      });

      // Then
      expect(size).toBe(expected);
    },
  );

  it("정의에 적은 값이 폴링 종류의 기본값보다 앞선다", () => {
    // When
    const size = resolveBacklogWarningSize({
      backlogWarningSize: 100_000,
      worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
    });

    // Then
    expect(size).toBe(100_000);
  });
});
