import { HealthIndicatorService } from "@nestjs/terminus";
import { vi } from "vitest";

import type { JobQueueHealth } from "#api/shared/application/ports/job-queue.port";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { JobQueueHealthIndicator } from "./job-queue.health.js";

const HEALTHY: JobQueueHealth = {
  backend: "postgres",
  degraded: false,
  queues: {
    "ai-report-generation.v1": { waiting: 2, active: 1, failed: 0, oldestAgeSeconds: null },
  },
};

function indicatorWith(health: () => Promise<JobQueueHealth>): JobQueueHealthIndicator {
  const jobQueue = new InMemoryJobQueue();
  jobQueue.health = health;
  return new JobQueueHealthIndicator(new HealthIndicatorService(), jobQueue);
}

describe("JobQueueHealthIndicator — 작업 큐 상태 확인", () => {
  it("backend와 큐 카운트를 up 응답으로 반환한다", async () => {
    // Given
    const indicator = indicatorWith(async () => HEALTHY);

    // When
    const result = await indicator.isHealthy("queues");

    // Then
    expect(result.queues).toMatchObject({
      status: "up",
      backend: "postgres",
      degraded: false,
      queues: { "ai-report-generation.v1": { waiting: 2, active: 1 } },
    });
  });

  it("backend 장애도 503 대신 up + degraded로 유지한다", async () => {
    // Given
    const indicator = indicatorWith(async () => ({
      backend: "postgres",
      degraded: true,
      reason: "job_runtime_unavailable",
      queues: {},
    }));

    // When
    const result = await indicator.isHealthy("queues");

    // Then
    expect(result.queues).toMatchObject({
      status: "up",
      degraded: true,
      reason: "job_runtime_unavailable",
    });
  });

  it("health 수집 실패도 up + degraded로 정규화한다", async () => {
    // Given
    const indicator = indicatorWith(async () => {
      throw new Error("database unavailable");
    });

    // When
    const result = await indicator.isHealthy("queues");

    // Then
    expect(result.queues).toMatchObject({
      status: "up",
      degraded: true,
      reason: "job_runtime_health_timeout",
    });
  });

  it("health가 멈추면 2초 후 degraded로 반환한다", async () => {
    // Given
    vi.useFakeTimers();
    const indicator = indicatorWith(() => new Promise(() => {}));

    // When
    const pending = indicator.isHealthy("queues");
    await vi.advanceTimersByTimeAsync(2000);

    // Then
    await expect(pending).resolves.toMatchObject({
      queues: { status: "up", degraded: true },
    });
    vi.useRealTimers();
  });
});
