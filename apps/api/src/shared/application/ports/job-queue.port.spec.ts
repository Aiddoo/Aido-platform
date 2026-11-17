import {
  JOB_BACKLOG_WARNING_SIZE,
  JOB_POLLING_SECONDS,
  resolveBacklogWarningSize,
  resolveDeadLetterJobPolicy,
  resolveDeadLetterQueue,
} from "./job-queue.port.js";

const BASE_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 600,
  retentionSeconds: 14 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
} as const;

describe("dead-letter 큐 정책 정규화", () => {
  it("typed DLQ는 queue 이름과 독립 retry policy를 보존한다", () => {
    // Given
    const jobPolicy = { ...BASE_OPTIONS };
    const deadLetter = { queue: "push-dead-letter.v1", jobPolicy } as const;

    // When
    const queue = resolveDeadLetterQueue(deadLetter);
    const policy = resolveDeadLetterJobPolicy(deadLetter);

    // Then
    expect(queue).toBe("push-dead-letter.v1");
    expect(policy).toBe(jobPolicy);
  });

  it("rolling 배포의 legacy 문자열은 queue 이름만 보존한다", () => {
    // When
    const queue = resolveDeadLetterQueue("push-dead-letter.v1");
    const policy = resolveDeadLetterJobPolicy("push-dead-letter.v1");

    // Then
    expect(queue).toBe("push-dead-letter.v1");
    expect(policy).toBeUndefined();
  });
});

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
