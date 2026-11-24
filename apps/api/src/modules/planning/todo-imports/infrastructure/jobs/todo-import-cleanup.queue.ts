import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

const todoImportCleanupPayloadSchema = z.object({});

/**
 * 매일 한 번 멈춘 가져오기를 다시 넣거나 닫고(재조정) 끝난 가져오기를 정리한다. 상태 기준 조회라 놓친 날은 다음
 * 실행이 함께 처리해 skip이다. 다른 정리 작업과 겹치지 않게 04:20 KST에 둔다
 */
export const TODO_IMPORT_CLEANUP_QUEUE = defineQueue({
  name: "planning.todo-import-cleanup.v1",
  payloadSchema: todoImportCleanupPayloadSchema,
  retry: {
    retryLimit: 2,
    retryDelaySeconds: 60,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
    retentionSeconds: DAY_SECONDS,
    deleteAfterSeconds: DAY_SECONDS,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-todo-import-cleanup-scheduler",
      cron: "20 4 * * *",
      timezone: "Asia/Seoul",
      missed: "skip",
      payload: {},
    },
  ],
});
