import type { EnqueueJobOptions } from "#api/shared/application/ports/job-runtime.port";

export const TODO_SERIES_MATERIALIZATION_QUEUE = "todo-series-materialization.v1";
export const TODO_SERIES_MATERIALIZATION_JOB_NAME = "materialize-due-series";

export const TODO_SERIES_MATERIALIZATION_SCHEDULE = {
  id: "daily-todo-series-materialization-scheduler",
  cron: "10 3 * * *",
  /** 사용자 시간대와 무관한 운영 배치로, 한국 새벽 저트래픽 시간에 돈다 */
  timezone: "Asia/Seoul",
  catchUpHour: 3,
  catchUpMinute: 10,
};

export const TODO_SERIES_MATERIALIZATION_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 30,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
  timezone: TODO_SERIES_MATERIALIZATION_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;

export const TodoSeriesMaterializationJobKey = {
  catchUp: (localDate: string): string => `materialize_series_${localDate}`,
};
