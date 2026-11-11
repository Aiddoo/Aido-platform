import { Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import { withTimeout } from "es-toolkit";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

const QUEUE_STATS_TIMEOUT_MS = 2000;

/**
 * 작업 큐의 상태를 vendor-neutral 형식으로 노출한다. 큐 목록은 이 프로세스가 정의로 쓴 큐다.
 * 큐 장애는 프로세스 재시작으로 해결되지 않으므로 503 대신 degraded로 알린다.
 */
@Injectable()
export class JobQueueHealthIndicator {
  readonly #healthIndicatorService: HealthIndicatorService;
  readonly #jobQueue: Pick<JobQueuePort, "health">;

  constructor(healthIndicatorService: HealthIndicatorService, jobQueue: JobQueuePort) {
    this.#healthIndicatorService = healthIndicatorService;
    this.#jobQueue = jobQueue;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.#healthIndicatorService.check(key);
    try {
      const health = await withTimeout(() => this.#jobQueue.health(), QUEUE_STATS_TIMEOUT_MS);
      return indicator.up({ ...health });
    } catch {
      return indicator.up({
        degraded: true,
        reason: "job_runtime_health_timeout",
      });
    }
  }
}
