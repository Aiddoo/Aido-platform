import type { Logger } from "@nestjs/common";
import { z } from "zod";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { defineAlerts } from "#api/shared/application/alerts/define-alerts";
import type {
  OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";
import { toIsoString } from "#api/shared/domain/time/instant";

// 같은 원인이 한 Sentry 이슈로 모이도록 subject에 큐·스케줄·오류 종류만 싣는다(`job.failed:<큐>:<오류 종류>`)
export const JobAlerts = defineAlerts("job", {
  FAILED: {
    key: "job.failed",
    severity: "error",
    summary: "작업이 재시도를 모두 쓰고 실패해 DLQ로 옮겨졌다",
    runbook:
      "태그 queue·error.type과 jobs.job.failed 로그로 원인을 고친다. DLQ에 남은 작업은 고친 뒤 다시 넣고, 같은 오류가 이어지면 큐를 멈출지 정한다.",
  },
});

export const ScheduleAlerts = defineAlerts("schedule", {
  OVERDUE: {
    key: "schedule.overdue",
    severity: "error",
    summary: "예정 실행 두 번이 지나도록 끝난 실행이 없다",
    runbook:
      "태그 schedule.key의 큐가 pg-boss에 스케줄로 남아 있는지, worker가 살아 있는지(/health jobs, Sentry cron 모니터)를 본다. 배포 직후면 다음 실행을 기다린다.",
  },
  FAILING: {
    key: "schedule.failing",
    severity: "error",
    summary: "최근 예정 실행이 모두 실패했다",
    runbook:
      "같은 큐의 job.failed 경보와 로그에서 오류 종류를 찾아 고친다. 고친 뒤 다음 예정 실행이 끝나는지 확인한다.",
  },
});

export const QueueAlerts = defineAlerts("queue", {
  DEAD_LETTER: {
    key: "queue.dead-letter",
    severity: "warning",
    summary: "DLQ에 작업이 들어왔다",
    runbook:
      "태그 queue의 원래 큐에서 같은 시각 job.failed 경보를 본다. 원인을 고친 뒤 DLQ 작업을 다시 넣거나 지운다.",
  },
});

// payload가 schema에 맞지 않아 handler에 넘기지 못한 실패의 오류 종류
export const INVALID_JOB_PAYLOAD_ERROR_TYPE = "InvalidJobPayload";

// payload의 작업 종류(`{ name, data }`의 name)만 태그로 싣는다. 고정 기호가 아닌 값은 버린다
const jobKindSchema = z.object({
  name: z
    .string()
    .max(64)
    .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/),
});

export function jobKindOf(payload: unknown): string | null {
  const parsed = jobKindSchema.safeParse(payload);
  return parsed.success ? parsed.data.name : null;
}

export interface FailedJobAttempt {
  readonly queue: string;
  readonly jobId: string;
  readonly jobKind: string | null;
  /** 1부터 센다 */
  readonly attempt: number;
  readonly retryLimit: number;
  readonly errorType: string;
}

interface JobFailureReporting {
  readonly logger: Pick<Logger, "warn" | "error">;
  readonly alerts: OperationalAlertPort | null;
}

/**
 * 재시도가 남은 실패는 로그만 남기고, 재시도를 다 쓴 실패(DLQ로 옮겨지는 때)는 경보까지 올린다.
 * payload 값과 예외 message는 공급자 원문이 섞일 수 있어 싣지 않는다.
 */
export function reportFailedJobAttempt(
  failure: FailedJobAttempt,
  { logger, alerts }: JobFailureReporting,
): void {
  const fields = {
    queue: failure.queue,
    jobId: failure.jobId,
    jobKind: failure.jobKind,
    attempt: failure.attempt,
    retryLimit: failure.retryLimit,
    errorType: failure.errorType,
  };
  if (failure.attempt <= failure.retryLimit) {
    logger.warn({ event: PlatformLogEvent.JOB_ATTEMPT_FAILED, ...fields });
    return;
  }
  logger.error({ event: PlatformLogEvent.JOB_FAILED, ...fields });
  alerts?.raise(jobFailedAlert(failure));
}

function jobFailedAlert(failure: FailedJobAttempt): OperationalAlert {
  return {
    ...JobAlerts.FAILED,
    subject: `${failure.queue}:${failure.errorType}`,
    tags: {
      queue: failure.queue,
      "job.name": failure.jobKind ?? failure.queue,
      "job.attempt": String(failure.attempt),
      "error.type": failure.errorType,
    },
    details: { retryLimit: failure.retryLimit },
  };
}

export interface WatchedScheduleRef {
  readonly queue: string;
  readonly scheduleKey: string;
  readonly cron: string;
  readonly timezone: string;
}

export function scheduleOverdueAlert(
  schedule: WatchedScheduleRef,
  latestDueAt: Temporal.Instant,
): OperationalAlert {
  return {
    ...ScheduleAlerts.OVERDUE,
    subject: schedule.scheduleKey,
    tags: { queue: schedule.queue, "schedule.key": schedule.scheduleKey },
    details: {
      cron: schedule.cron,
      timezone: schedule.timezone,
      latestDueAt: toIsoString(latestDueAt),
    },
  };
}

export function scheduleFailingAlert(
  schedule: WatchedScheduleRef,
  failedRuns: number,
): OperationalAlert {
  return {
    ...ScheduleAlerts.FAILING,
    subject: schedule.scheduleKey,
    tags: { queue: schedule.queue, "schedule.key": schedule.scheduleKey },
    details: { cron: schedule.cron, timezone: schedule.timezone, failedRuns },
  };
}

export function deadLetterAlert({
  queue,
  arrivals,
  windowMinutes,
}: {
  readonly queue: string;
  readonly arrivals: number;
  readonly windowMinutes: number;
}): OperationalAlert {
  return {
    ...QueueAlerts.DEAD_LETTER,
    subject: queue,
    tags: { queue },
    details: { arrivals, windowMinutes },
  };
}
