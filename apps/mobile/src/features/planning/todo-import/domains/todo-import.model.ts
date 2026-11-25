import {
  TODO_IMPORT_FAILURE_REASONS,
  TODO_IMPORT_SOURCE_UNKNOWN,
  TODO_IMPORT_SOURCES,
  TODO_IMPORT_STATUSES,
  TODO_IMPORT_TIME_MODES,
  TODO_VISIBILITIES,
} from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { hasInstantPassed, type Instant, instantSchema } from '@src/shared/date/instant';
import { clamp, uniq } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

const countSchema = z.int().nonnegative();

/** 상태·수·되돌리기 기한은 서버가 정하고 앱은 읽기만 한다 */
export const todoImportSchema = z.object({
  id: z.string(),
  source: z.enum([...TODO_IMPORT_SOURCES, TODO_IMPORT_SOURCE_UNKNOWN]),
  status: z.enum(TODO_IMPORT_STATUSES),
  /** FAILED가 된 이유. FAILED가 아니면 null */
  failureReason: z.enum(TODO_IMPORT_FAILURE_REASONS).nullable(),
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  /** 날짜·시각을 해석하는 시간대. 이어 보낼 때도 기기 시간대가 아니라 이 값을 쓴다 */
  timezone: z.string(),
  timeMode: z.enum(TODO_IMPORT_TIME_MODES),
  visibility: z.enum(TODO_VISIBILITIES),
  expectedItemCount: countSchema,
  receivedItemCount: countSchema,
  processedItemCount: countSchema,
  counts: z.object({
    created: countSchema,
    skippedDuplicate: countSchema,
    skippedCapacity: countSchema,
    skippedCategoryMissing: countSchema,
    skippedInvalid: countSchema,
    undone: countSchema,
    keptCompleted: countSchema,
  }),
  collections: z.array(
    z.object({ collectionKey: z.string(), categoryId: z.int().positive().nullable() }),
  ),
  firstDate: dateKeySchema.nullable(),
  undoableUntil: instantSchema.nullable(),
  createdAt: instantSchema,
  completedAt: instantSchema.nullable(),
});
export type TodoImport = z.infer<typeof todoImportSchema>;

/**
 * 이 기기가 그 가져오기를 올리는 상태. sending: 보내는 중이거나 이어 보낼 상태를 갖고 있다, paused: 멈췄다,
 * failed: 서버가 받지 않았다, elsewhere: 보내지도 이어 보낼 상태를 갖고 있지도 않다(다른 기기에서 시작했다)
 */
export type TodoImportDeviceUpload = 'sending' | 'paused' | 'failed' | 'elsewhere';

/** 다시 가져와도 아무것도 만들지 않은 가져오기가 앞의 되돌릴 수 있는 가져오기를 가리지 않을 만큼 남긴다 */
const MAX_REMEMBERED_IMPORT_COUNT = 3;

/** 최근에 시작한 가져오기 id(새것이 앞). 같은 가져오기는 앞으로 옮기고 오래된 것부터 뺀다 */
export function rememberTodoImportId(ids: readonly string[], importId: string): string[] {
  return uniq([importId, ...ids]).slice(0, MAX_REMEMBERED_IMPORT_COUNT);
}

export const TodoImportPolicy = {
  isTerminal(todoImport: TodoImport): boolean {
    return match(todoImport.status)
      .with(P.union('COMPLETED', 'FAILED', 'CANCELED', 'ABANDONED', 'UNDONE'), () => true)
      .with(P.union('UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING'), () => false)
      .exhaustive();
  },

  /**
   * 되돌릴 수 있는지는 서버가 정한다. 완료·실패이고 남은 할 일이 있으며 7일 안일 때만 기한이 온다.
   * 앱은 지금이 그 기한 전인지만 본다
   */
  canUndo(todoImport: TodoImport, now: Instant): boolean {
    return todoImport.undoableUntil != null && !hasInstantPassed(todoImport.undoableUntil, now);
  },

  /** 확정 뒤에는 서버 잡이 끝까지 만든다 */
  canCancel(todoImport: TodoImport): boolean {
    return todoImport.status === 'UPLOADING';
  },

  /** 업로드 중인데 이 기기가 더 보내지 않으면(멈춤·거절·다른 기기에서 시작) 사용자가 멈출 수 있다 */
  canStop(todoImport: TodoImport, deviceUpload: TodoImportDeviceUpload): boolean {
    return this.canCancel(todoImport) && deviceUpload !== 'sending';
  },

  /** 받은 수가 없으면 0이다 */
  calculateProcessedRatio(todoImport: TodoImport): number {
    const total = Math.max(todoImport.receivedItemCount, todoImport.expectedItemCount);
    return total === 0 ? 0 : clamp(todoImport.processedItemCount / total, 0, 1);
  },
};
