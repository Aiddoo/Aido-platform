import { Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import { uniq, withTimeout } from "es-toolkit";

import { AI_REPORT_QUEUE } from "#api/modules/ai-assistance/reports/ai-assistance-reports.public";
import { ACCOUNT_PURGE_QUEUE } from "#api/modules/identity/users/identity-users.public";
import {
  INVITE_MAINTENANCE_QUEUE,
  INVITE_REWARD_QUEUE,
} from "#api/modules/social/invites/social-invites.public";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { USAGE_RETENTION_QUEUE } from "#api/platform/metering/usage-retention.job";
import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

const QUEUE_STATS_TIMEOUT_MS = 2000;
// defineQueue로 옮긴 큐는 JobQueueRegistry가 알려 주므로 Context를 옮길 때 이 목록에서 뺀다
const LEGACY_MONITORED_QUEUES = [
  AI_REPORT_QUEUE,
  ACCOUNT_PURGE_QUEUE,
  INVITE_REWARD_QUEUE,
  INVITE_MAINTENANCE_QUEUE,
  USAGE_RETENTION_QUEUE,
] as const;

/**
 * 선택된 durable job backend의 상태를 vendor-neutral 형식으로 노출한다.
 * 큐 장애는 프로세스 재시작으로 해결되지 않으므로 503 대신 degraded로 알린다.
 */
@Injectable()
export class JobRuntimeHealthIndicator {
  readonly #healthIndicatorService: HealthIndicatorService;
  readonly #runtime: JobRuntimePort;
  readonly #registry: JobQueueRegistry;

  constructor(
    healthIndicatorService: HealthIndicatorService,
    runtime: JobRuntimePort,
    registry: JobQueueRegistry,
  ) {
    this.#healthIndicatorService = healthIndicatorService;
    this.#runtime = runtime;
    this.#registry = registry;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.#healthIndicatorService.check(key);
    try {
      const health = await withTimeout(
        () => this.#runtime.health(this.#monitoredQueues()),
        QUEUE_STATS_TIMEOUT_MS,
      );
      return indicator.up({ ...health });
    } catch {
      return indicator.up({
        degraded: true,
        reason: "job_runtime_health_timeout",
      });
    }
  }

  #monitoredQueues(): readonly string[] {
    return uniq([...LEGACY_MONITORED_QUEUES, ...this.#registry.queueNames()]);
  }
}
