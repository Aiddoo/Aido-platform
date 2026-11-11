import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

const TODO_SERIES_MATERIALIZATION_JOB_NAME = "materialize-due-series";

/** 사용자 시간대와 무관한 운영 배치로, 한국 새벽 저트래픽 시간에 돈다 */
export const TODO_SERIES_MATERIALIZATION_SCHEDULE_TIME = {
  timezone: "Asia/Seoul",
  hour: 3,
  minute: 10,
} as const;

// 옛 스케줄이 넣은 작업이 { name, data: {} } 모양이라 그대로 받는다
const todoSeriesMaterializationPayloadSchema = z.object({
  name: z.literal(TODO_SERIES_MATERIALIZATION_JOB_NAME),
  data: z.object({}),
});

export const TODO_SERIES_MATERIALIZATION_PAYLOAD = {
  name: TODO_SERIES_MATERIALIZATION_JOB_NAME,
  data: {},
} as const;

// 회차는 90일 앞까지 있어 하루 빠져도 영향이 없고 실행은 멱등이다. 배포로 놓친 실행은 한 번만 보낸다
export const TODO_SERIES_MATERIALIZATION_QUEUE = defineQueue({
  name: "todo-series-materialization.v1",
  payloadSchema: todoSeriesMaterializationPayloadSchema,
  retry: {
    retryLimit: 2,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
    retentionSeconds: 7 * 24 * 60 * 60,
    deleteAfterSeconds: 24 * 60 * 60,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-todo-series-materialization-scheduler",
      cron: "10 3 * * *",
      timezone: TODO_SERIES_MATERIALIZATION_SCHEDULE_TIME.timezone,
      missed: "once",
      payload: TODO_SERIES_MATERIALIZATION_PAYLOAD,
    },
  ],
});

export const TodoSeriesMaterializationJobKey = {
  catchUp: (localDate: string): string => `materialize_series_${localDate}`,
};
