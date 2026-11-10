import type { Logger } from "@nestjs/common";
import { z } from "zod";

import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import type {
  OperationalAlert,
  OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

/** 같은 원인이 한 Sentry 이슈로 모이도록 큐·스케줄·오류 종류만으로 key를 만든다. */
export const JobAlertKey = {
  failed: (queue: string, errorType: string) => `job.failed:${queue}:${errorType}`,
} as const;

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
    key: JobAlertKey.failed(failure.queue, failure.errorType),
    severity: "error",
    message: `작업이 재시도를 모두 쓰고 실패했다 (${failure.queue})`,
    tags: {
      queue: failure.queue,
      "job.name": failure.jobKind ?? failure.queue,
      "job.attempt": String(failure.attempt),
      "error.type": failure.errorType,
    },
    details: { retryLimit: failure.retryLimit },
  };
}
