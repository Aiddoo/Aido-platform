import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

const todoImportReconcilePayloadSchema = z.object({});

/**
 * 10분마다 멈춘 가져오기를 다시 넣거나 닫는다. 죽은 worker가 남긴 진행 중 가져오기가 사용자의 새 가져오기를
 * 오래 막지 않게 한다. 상태 기준 조회라 놓친 실행은 다음 실행이 함께 처리해 skip이다
 */
export const TODO_IMPORT_RECONCILE_QUEUE = defineQueue({
  name: "planning.todo-import-reconcile.v1",
  payloadSchema: todoImportReconcilePayloadSchema,
  retry: {
    retryLimit: 1,
    retryDelaySeconds: 60,
    retryBackoff: false,
    expireInSeconds: 5 * 60,
    retentionSeconds: DAY_SECONDS,
    deleteAfterSeconds: DAY_SECONDS,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "todo-import-reconcile-scheduler",
      cron: "*/10 * * * *",
      timezone: "UTC",
      missed: "skip",
      payload: {},
    },
  ],
});
