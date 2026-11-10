import { HealthIndicatorService } from "@nestjs/terminus";
import { vi, type Mocked } from "vitest";
import { z } from "zod";

import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { defineQueue } from "#api/shared/application/ports/job-queue.port";
import type { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { JobRuntimeHealthIndicator } from "./job-runtime.health.js";

function runtime(): Mocked<JobRuntimePort> {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    enqueue: vi.fn(),
    enqueueMany: vi.fn(),
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
    const indicator = new JobRuntimeHealthIndicator(
      new HealthIndicatorService(),
      jobRuntime,
      new JobQueueRegistry(),
    );

    const result = await indicator.isHealthy("queues");

    expect(result.queues).toMatchObject({
      status: "up",
      backend: "postgres",
      degraded: false,
    });
    expect(jobRuntime.health).toHaveBeenCalledWith([
      "ai-report-generation.v1",
      "account-purge.v1",
      "invite-reward.v1",
      "invite-maintenance.v1",
      "outbound-usage-retention.v1",
    ]);
  });

  it("defineQueue로 등록된 큐와 DLQ를 옛 목록에 한 번씩 더해 본다", async () => {
    // Given
    const jobRuntime = runtime();
    const registry = new JobQueueRegistry();
    const policy = {
      retryLimit: 1,
      retryDelaySeconds: 1,
      retryBackoff: false,
      expireInSeconds: 60,
      retentionSeconds: 60,
      deleteAfterSeconds: 60,
    };
    registry.register(
      defineQueue({
        name: "sample.v1",
        payloadSchema: z.object({ id: z.string() }),
        retry: policy,
        deadLetter: { queue: "sample-dead-letter.v1", jobPolicy: policy },
        worker: { localConcurrency: 1, pollingIntervalSeconds: 2 },
      }),
    );
    registry.register(
      defineQueue({
        name: "account-purge.v1",
        payloadSchema: z.object({ id: z.string() }),
        retry: policy,
        worker: { localConcurrency: 1, pollingIntervalSeconds: 2 },
      }),
    );
    const indicator = new JobRuntimeHealthIndicator(
      new HealthIndicatorService(),
      jobRuntime,
      registry,
    );

    // When
    await indicator.isHealthy("queues");

    // Then
    const [queueNames] = jobRuntime.health.mock.calls[0] ?? [];
    expect(queueNames).toHaveLength(7);
    expect(queueNames?.slice(-2)).toEqual(["sample.v1", "sample-dead-letter.v1"]);
  });

  it("backend 장애도 503 대신 up + degraded로 유지한다", async () => {
    const jobRuntime = runtime();
    jobRuntime.health.mockResolvedValue({
      backend: "postgres",
      degraded: true,
      reason: "job_runtime_unavailable",
      queues: {},
    });
    const indicator = new JobRuntimeHealthIndicator(
      new HealthIndicatorService(),
      jobRuntime,
      new JobQueueRegistry(),
    );

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
    const indicator = new JobRuntimeHealthIndicator(
      new HealthIndicatorService(),
      jobRuntime,
      new JobQueueRegistry(),
    );

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
    const indicator = new JobRuntimeHealthIndicator(
      new HealthIndicatorService(),
      jobRuntime,
      new JobQueueRegistry(),
    );

    const pending = indicator.isHealthy("queues");
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toMatchObject({
      queues: { status: "up", degraded: true },
    });
    vi.useRealTimers();
  });
});
