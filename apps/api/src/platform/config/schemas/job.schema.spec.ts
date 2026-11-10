import { jobSchema } from "./job.schema.js";

describe("jobSchema — 작업 런타임 설정", () => {
  it("미설정 시 pg-boss 스키마와 종료 기본값을 쓴다", () => {
    // When
    const config = jobSchema.parse({});

    // Then
    expect(config).toEqual({
      JOB_SCHEMA: "pgboss",
      JOB_SHUTDOWN_TIMEOUT_MS: 90_000,
    });
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
