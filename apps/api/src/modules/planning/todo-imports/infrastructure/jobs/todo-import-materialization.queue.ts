import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

const todoImportMaterializationPayloadSchema = z.object({
  importId: z.string(),
  round: z.int().nonnegative(),
});

export type TodoImportMaterializationPayload = z.infer<
  typeof todoImportMaterializationPayloadSchema
>;

/** round마다 작업 id가 하나라 같은 round를 두 번 넣어도 한 번만 남는다. 문자열은 운영 계약이다 */
export function todoImportMaterializationJobKey(payload: TodoImportMaterializationPayload): string {
  return `todo-import:${payload.importId}:${payload.round}`;
}

// 사용자가 진행 막대를 보고 있어 사람이 기다리는 폴링이다. 상태는 가져오기 행에 있어 보관을 하루로 짧게 둔다
export const TODO_IMPORT_MATERIALIZATION_QUEUE = defineQueue({
  name: "planning.todo-import-materialization.v1",
  payloadSchema: todoImportMaterializationPayloadSchema,
  retry: {
    retryLimit: 3,
    retryDelaySeconds: 10,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
    retentionSeconds: DAY_SECONDS,
    deleteAfterSeconds: DAY_SECONDS,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE },
});
