import { DatabaseError } from "pg";
import { vi } from "vitest";

import { PgBossErrorLogSampler } from "./pg-boss-error-log-sampler.js";

const WINDOW_MS = 30_000;

// pg-boss 12 워커가 error 이벤트로 넘기는 모양: Error를 펼친 일반 객체에 queue·worker를 더한다
function workerConnectionRefused(queue: string): object {
  const refused = Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:5432"), {
    errno: -111,
    code: "ECONNREFUSED",
    syscall: "connect",
    address: "10.0.0.1",
    port: 5432,
  });
  return {
    ...refused,
    message: `${refused.message} (Queue: ${queue}, Worker: worker-1)`,
    stack: refused.stack,
    queue,
    worker: "worker-1",
  };
}

function adminShutdown(): DatabaseError {
  const error = new DatabaseError(
    "terminating connection due to administrator command",
    0,
    "error",
  );
  error.severity = "FATAL";
  error.code = "57P01";
  return error;
}

describe("PgBossErrorLogSampler", () => {
  let entries: unknown[];
  let sampler: PgBossErrorLogSampler;

  beforeEach(() => {
    vi.useFakeTimers();
    entries = [];
    sampler = new PgBossErrorLogSampler({ error: (entry) => entries.push(entry) }, WINDOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("워커 연결 오류는 원문 없이 네트워크 code와 큐 이름을 남긴다", () => {
    // When
    sampler.error(workerConnectionRefused("todo-reminder.v1"));

    // Then
    expect(entries).toEqual([
      {
        event: "jobs.runtime.errored",
        backend: "postgres",
        errorType: "UnknownError",
        networkCode: "ECONNREFUSED",
        queue: "todo-reminder.v1",
        suppressed: 0,
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain("10.0.0.1");
  });

  it("PostgreSQL이 끊은 연결은 SQLSTATE로 남긴다", () => {
    // When
    sampler.error(adminShutdown());

    // Then
    expect(entries).toEqual([
      {
        event: "jobs.runtime.errored",
        backend: "postgres",
        errorType: "error",
        sqlState: "57P01",
        suppressed: 0,
      },
    ]);
  });

  it("같은 창 안에서 반복된 오류는 한 번만 남긴다", () => {
    // When
    for (let i = 0; i < 100; i++) {
      sampler.error(workerConnectionRefused(`queue-${i % 28}.v1`));
    }

    // Then
    expect(entries).toHaveLength(1);
  });

  it("창이 지나면 그동안 억제한 수와 함께 다시 남긴다", () => {
    // Given
    for (let i = 0; i < 5; i++) {
      sampler.error(workerConnectionRefused("todo-reminder.v1"));
    }

    // When
    vi.advanceTimersByTime(WINDOW_MS);
    sampler.error(adminShutdown());

    // Then
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({ sqlState: "57P01", suppressed: 4 });
  });
});
