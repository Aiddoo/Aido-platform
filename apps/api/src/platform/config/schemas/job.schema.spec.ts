import { jobSchema } from "./job.schema.js";

describe("jobSchema — 작업 런타임 설정", () => {
  it("미설정 시 worker를 켜고 pg-boss 스키마·종료 대기·풀 기본값을 쓴다", () => {
    // When
    const config = jobSchema.parse({});

    // Then
    expect(config).toEqual({
      JOB_SCHEMA: "pgboss",
      JOB_SHUTDOWN_TIMEOUT_MS: 90_000,
      JOB_WORKER_ENABLED: true,
      JOB_POOL_MAX: 3,
    });
  });

  it("worker를 끄고 풀 크기를 줄인 값을 읽는다", () => {
    // When
    const config = jobSchema.parse({ JOB_WORKER_ENABLED: "false", JOB_POOL_MAX: "1" });

    // Then
    expect(config).toMatchObject({ JOB_WORKER_ENABLED: false, JOB_POOL_MAX: 1 });
  });

  it("배포 env에 남은 이전 backend 선택·폴링 값은 무시한다", () => {
    // When
    const config = jobSchema.parse({
      JOB_BACKEND: "postgres",
      JOB_REDIS_DRAIN_ENABLED: "false",
      JOB_POLLING_INTERVAL_SECONDS: "2",
    });

    // Then
    expect(config).not.toHaveProperty("JOB_BACKEND");
    expect(config).not.toHaveProperty("JOB_REDIS_DRAIN_ENABLED");
    expect(config).not.toHaveProperty("JOB_POLLING_INTERVAL_SECONDS");
  });
});
