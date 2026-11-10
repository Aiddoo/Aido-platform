import { Inject, Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";
import { uniq, withTimeout } from "es-toolkit";

import { QUOTA_ABANDONED_REFUND_QUEUE } from "#api/modules/access/access-quota-jobs.public";
import { AI_REPORT_QUEUE } from "#api/modules/ai-assistance/ai-assistance-reports.public";
import { AI_SUGGESTION_QUEUE } from "#api/modules/ai-assistance/ai-assistance-suggestions.public";
import { ACCOUNT_PURGE_QUEUE } from "#api/modules/identity/users/identity-users.public";
import {
  MARKETING_CONSENT_RECONFIRM_QUEUE,
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_QUEUE,
  PUSH_DELIVERY_DEAD_LETTER_QUEUE,
  PUSH_DELIVERY_QUEUE,
} from "#api/modules/notification/notification-delivery-jobs.public";
import { EMAIL_DELIVERY_QUEUE } from "#api/modules/notification/notification-email-jobs.public";
import { TIMEZONE_REMINDER_QUEUE } from "#api/modules/notification/notification-reminders-jobs.public";
import { TODO_REMINDER_QUEUE } from "#api/modules/notification/notification-reminders.public";
import { RETENTION_QUEUE } from "#api/modules/notification/notification-retention-jobs.public";
import { TODO_SERIES_MATERIALIZATION_QUEUE } from "#api/modules/planning/planning-todo-series-jobs.public";
import { TODO_TIMEZONE_REBASE_QUEUE } from "#api/modules/planning/planning-todo-timezone-jobs.public";
import {
  INVITE_MAINTENANCE_QUEUE,
  INVITE_REWARD_QUEUE,
} from "#api/modules/social/social-invites.public";
import { PLAN_APPLICATION_CLEANUP_QUEUE } from "#api/modules/voice/voice.public";
import { JobQueueRegistry } from "#api/platform/jobs/job-queue.registry";
import { USAGE_RETENTION_QUEUE } from "#api/platform/metering/usage-retention.job";
import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

const QUEUE_STATS_TIMEOUT_MS = 2_000;
// defineQueue로 옮긴 큐는 JobQueueRegistry가 알려 주므로 Context를 옮길 때 이 목록에서 뺀다
const LEGACY_MONITORED_QUEUES = [
  AI_SUGGESTION_QUEUE,
  AI_REPORT_QUEUE,
  EMAIL_DELIVERY_QUEUE,
  TODO_REMINDER_QUEUE,
  NOTIFICATION_QUEUE,
  NOTIFICATION_DEAD_LETTER_QUEUE,
  PUSH_DELIVERY_QUEUE,
  PUSH_DELIVERY_DEAD_LETTER_QUEUE,
  RETENTION_QUEUE,
  TODO_SERIES_MATERIALIZATION_QUEUE,
  TODO_TIMEZONE_REBASE_QUEUE,
  QUOTA_ABANDONED_REFUND_QUEUE,
  ACCOUNT_PURGE_QUEUE,
  MARKETING_CONSENT_RECONFIRM_QUEUE,
  TIMEZONE_REMINDER_QUEUE,
  INVITE_REWARD_QUEUE,
  INVITE_MAINTENANCE_QUEUE,
  PLAN_APPLICATION_CLEANUP_QUEUE,
  USAGE_RETENTION_QUEUE,
] as const;

/**
 * 선택된 durable job backend의 상태를 vendor-neutral 형식으로 노출한다.
 * 큐 장애는 프로세스 재시작으로 해결되지 않으므로 503 대신 degraded로 알린다.
 */
@Injectable()
export class JobRuntimeHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
    private readonly registry: JobQueueRegistry,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const health = await withTimeout(
        () => this.runtime.health(this.#monitoredQueues()),
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
    return uniq([...LEGACY_MONITORED_QUEUES, ...this.registry.queueNames()]);
  }
}
