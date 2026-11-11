import { z } from "zod";

import { type JobHeartbeatSchedule } from "#api/shared/application/ports/job-heartbeat.port";
import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

export const SCHEDULE_WATCHDOG_INTERVAL_MINUTES = 15;

const SCHEDULE_WATCHDOG_CRON = `*/${SCHEDULE_WATCHDOG_INTERVAL_MINUTES} * * * *`;
const SCHEDULE_WATCHDOG_TIMEZONE = "UTC";
const SCHEDULE_WATCHDOG_EXPIRE_MINUTES = 5;

/**
 * 15분마다 등록된 모든 스케줄과 DLQ 유입을 본다. 놓친 실행은 다음 실행이 같은 것을 다시 보므로
 * skip이고, 실패해도 다음 실행이 다시 보므로 재시도하지 않는다.
 */
export const SCHEDULE_WATCHDOG_QUEUE = defineQueue({
  name: "schedule-watchdog.v1",
  payloadSchema: z.strictObject({}),
  retry: {
    retryLimit: 0,
    retryDelaySeconds: 60,
    retryBackoff: false,
    expireInSeconds: SCHEDULE_WATCHDOG_EXPIRE_MINUTES * 60,
    retentionSeconds: 60 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "schedule-watchdog-scheduler",
      cron: SCHEDULE_WATCHDOG_CRON,
      timezone: SCHEDULE_WATCHDOG_TIMEZONE,
      missed: "skip",
      payload: {},
    },
  ],
});

/**
 * 감시 작업이 매 실행 보내는 worker 생존 신호. 배포가 15분 경계를 넘어 한 번 빠지는 것은 넘기고
 * 두 번 연속(약 35분) 끊기면 알린다.
 */
export const SCHEDULE_WATCHDOG_HEARTBEAT = {
  cron: SCHEDULE_WATCHDOG_CRON,
  timezone: SCHEDULE_WATCHDOG_TIMEZONE,
  graceMinutes: 5,
  maxRuntimeMinutes: SCHEDULE_WATCHDOG_EXPIRE_MINUTES,
  failuresBeforeAlert: 2,
} as const satisfies JobHeartbeatSchedule;
