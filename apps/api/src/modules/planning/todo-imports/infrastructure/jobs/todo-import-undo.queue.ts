import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

const todoImportUndoPayloadSchema = z.object({
  importId: z.string(),
  round: z.int().nonnegative(),
  afterTodoId: z.int().positive().nullable(),
});

export type TodoImportUndoPayload = z.infer<typeof todoImportUndoPayloadSchema>;

/** round마다 작업 id가 하나다. 문자열은 운영 계약이다 */
export function todoImportUndoJobKey(
  payload: Pick<TodoImportUndoPayload, "importId" | "round">,
): string {
  return `todo-import-undo:${payload.importId}:${payload.round}`;
}

export const TODO_IMPORT_UNDO_QUEUE = defineQueue({
  name: "planning.todo-import-undo.v1",
  payloadSchema: todoImportUndoPayloadSchema,
  retry: {
    retryLimit: 3,
    retryDelaySeconds: 10,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
    retentionSeconds: DAY_SECONDS,
    deleteAfterSeconds: DAY_SECONDS,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE },
  // 배포 중 두 프로세스·재시도·다음 round가 겹쳐도 가져오기 하나에는 작업 하나만 돈다(실행 key = 가져오기 id)
  singleActivePerKey: true,
});
