import { resolveDeadLetterJobPolicy, resolveDeadLetterQueue } from "./job-queue.port.js";

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
    const jobPolicy = { ...BASE_OPTIONS };
    const deadLetter = { queue: "push-dead-letter.v1", jobPolicy } as const;

    expect(resolveDeadLetterQueue(deadLetter)).toBe("push-dead-letter.v1");
    expect(resolveDeadLetterJobPolicy(deadLetter)).toBe(jobPolicy);
  });

  it("rolling 배포의 legacy 문자열은 queue 이름만 보존한다", () => {
    expect(resolveDeadLetterQueue("push-dead-letter.v1")).toBe("push-dead-letter.v1");
    expect(resolveDeadLetterJobPolicy("push-dead-letter.v1")).toBeUndefined();
  });
});
