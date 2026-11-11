import * as Sentry from "@sentry/nestjs";

import {
  JobHeartbeatPort,
  type JobHeartbeatSchedule,
} from "#api/shared/application/ports/job-heartbeat.port";

/** 작업 worker 생존 신호를 받는 Sentry Crons 모니터. Sentry가 environment별로 나눠 보여 env로 바꾸지 않는다 */
const JOB_WORKER_MONITOR_SLUG = "aido-job-worker";

/**
 * Sentry Crons 모니터 하나에 시작·끝 check-in을 보낸다. 모니터 설정은 check-in마다 코드 값으로 upsert해
 * Sentry 화면에서 따로 만들거나 고치지 않는다. 무료 플랜은 Cron 모니터가 1개라 worker 전체에 하나만 쓴다.
 */
export class SentryJobHeartbeatAdapter extends JobHeartbeatPort {
  monitor<T>(schedule: JobHeartbeatSchedule, work: () => Promise<T>): Promise<T> {
    return Sentry.withMonitor(JOB_WORKER_MONITOR_SLUG, work, {
      schedule: { type: "crontab", value: schedule.cron },
      timezone: schedule.timezone,
      checkinMargin: schedule.graceMinutes,
      maxRuntime: schedule.maxRuntimeMinutes,
      failureIssueThreshold: schedule.failuresBeforeAlert,
      recoveryThreshold: 1,
    });
  }
}
