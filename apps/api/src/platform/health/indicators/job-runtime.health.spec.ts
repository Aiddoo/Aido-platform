import { HealthIndicatorService } from "@nestjs/terminus";
import { vi, type Mocked } from "vitest";

import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { JobRuntimeHealthIndicator } from "./job-runtime.health.js";

function runtime(): Mocked<JobRuntimePort> {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    enqueue: vi.fn(),
    schedule: vi.fn(),
    unschedule: vi.fn(),
    cancel: vi.fn(),
    work: vi.fn(),
    health: vi.fn().mockResolvedValue({
      backend: "postgres",
      degraded: false,
      queues: {
        "ai-report-generation.v1": {
          waiting: 2,
          active: 1,
          failed: 0,
          oldestAgeSeconds: null,
        },
      },
    }),
  };
}

describe("JobRuntimeHealthIndicator — 영속 job runtime 상태 확인", () => {
  it("선택된 backend와 큐 카운트를 up 응답으로 반환한다", async () => {
    const jobRuntime = runtime();
    const indicator = new JobRuntimeHealthIndicator(new HealthIndicatorService(), jobRuntime);

    const result = await indicator.isHealthy("queues");

    expect(result.queues).toMatchObject({
      status: "up",
      backend: "postgres",
      degraded: false,
    });
    expect(jobRuntime.health).toHaveBeenCalledWith([
      "ai-suggestion-analysis.v1",
      "ai-report-generation.v1",
      "admin-notification.v1",
      "todo-reminder.v1",
      "push-delivery.v1",
      "push-delivery-dead-letter.v1",
      "retention.v1",
      "retention-dead-letter.v1",
    ]);
  });

  it("backend 장애도 503 대신 up + degraded로 유지한다", async () => {
    const jobRuntime = runtime();
    jobRuntime.health.mockResolvedValue({
      backend: "postgres",
      degraded: true,
      reason: "job_runtime_unavailable",
      queues: {},
    });
    const indicator = new JobRuntimeHealthIndicator(new HealthIndicatorService(), jobRuntime);

    const result = await indicator.isHealthy("queues");

    expect(result.queues).toMatchObject({
      status: "up",
      degraded: true,
      reason: "job_runtime_unavailable",
    });
  });

  it("health 수집 실패도 up + degraded로 정규화한다", async () => {
    const jobRuntime = runtime();
    jobRuntime.health.mockRejectedValue(new Error("database unavailable"));
    const indicator = new JobRuntimeHealthIndicator(new HealthIndicatorService(), jobRuntime);

    const result = await indicator.isHealthy("queues");

    expect(result.queues).toMatchObject({
      status: "up",
      degraded: true,
      reason: "job_runtime_health_timeout",
    });
  });

  it("health가 멈추면 2초 후 degraded로 반환한다", async () => {
    vi.useFakeTimers();
    const jobRuntime = runtime();
    jobRuntime.health.mockReturnValue(new Promise(() => {}));
    const indicator = new JobRuntimeHealthIndicator(new HealthIndicatorService(), jobRuntime);

    const pending = indicator.isHealthy("queues");
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toMatchObject({
      queues: { status: "up", degraded: true },
    });
    vi.useRealTimers();
  });
});
