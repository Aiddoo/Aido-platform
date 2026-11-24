import {
  TODO_IMPORT_SOURCE_UNKNOWN,
  TODO_IMPORT_SOURCES,
  TODO_IMPORT_STATUSES,
  TODO_IMPORT_TIME_MODES,
  TODO_VISIBILITIES,
} from '@aido/api/vocabulary';
import { addDaysToDateKey, type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import { hasInstantPassed, type Instant, instantSchema } from '@src/shared/date/instant';
import { clamp } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

const countSchema = z.int().nonnegative();

/** 상태·수·되돌리기 기한은 서버가 정하고 앱은 읽기만 한다 */
export const todoImportSchema = z.object({
  id: z.string(),
  source: z.enum([...TODO_IMPORT_SOURCES, TODO_IMPORT_SOURCE_UNKNOWN]),
  status: z.enum(TODO_IMPORT_STATUSES),
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

/** 첫날을 포함해 `days`일째 되는 날 */
export function getRangeEndDate(startDate: DateKey, days: number): DateKey {
  return addDaysToDateKey(startDate, days - 1);
}

/** horizonDays는 서버 `CALENDAR_IMPORT.limit`이고 null은 기간 제한이 없다 */
export function findLastAllowedDate(todayKey: DateKey, horizonDays: number | null): DateKey | null {
  return horizonDays == null ? null : getRangeEndDate(todayKey, horizonDays);
}

export function canImportUntil(endDate: DateKey, todayKey: DateKey, horizonDays: number | null) {
  const lastAllowedDate = findLastAllowedDate(todayKey, horizonDays);
  return todayKey <= endDate && (lastAllowedDate == null || endDate <= lastAllowedDate);
}

// 업로드·대기는 서버 잡을 기다리는 동안이라 느리게, 만들기·되돌리기는 막대가 움직이니 빠르게 묻는다
const POLL_INTERVAL_MS = {
  UPLOADING: 3000,
  QUEUED: 3000,
  RUNNING: 2000,
  UNDOING: 2000,
} as const;

function isTerminal(todoImport: TodoImport) {
  return match(todoImport.status)
    .with(P.union('COMPLETED', 'FAILED', 'CANCELED', 'ABANDONED', 'UNDONE'), () => true)
    .with(P.union('UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING'), () => false)
    .exhaustive();
}

/** 모두 이미 가져온 일정이라 만든 할 일이 없으면 되돌릴 것도 없다 */
function canUndo(todoImport: TodoImport, now: Instant) {
  return (
    todoImport.status === 'COMPLETED' &&
    todoImport.counts.created > 0 &&
    todoImport.undoableUntil != null &&
    !hasInstantPassed(todoImport.undoableUntil, now)
  );
}

/** 확정 뒤에는 서버 잡이 끝까지 만든다 */
function canCancel(todoImport: TodoImport) {
  return todoImport.status === 'UPLOADING';
}

function getPollIntervalMs(todoImport: TodoImport): number | false {
  return match(todoImport.status)
    .with(P.union('COMPLETED', 'FAILED', 'CANCELED', 'ABANDONED', 'UNDONE'), () => false as const)
    .with(
      P.union('UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING'),
      (status) => POLL_INTERVAL_MS[status],
    )
    .exhaustive();
}

/** 받은 수가 없으면 0이다 */
function calculateProcessedRatio(todoImport: TodoImport) {
  const total = Math.max(todoImport.receivedItemCount, todoImport.expectedItemCount);
  return total === 0 ? 0 : clamp(todoImport.processedItemCount / total, 0, 1);
}

export const TodoImportPolicy = {
  isTerminal,
  canUndo,
  canCancel,
  getPollIntervalMs,
  calculateProcessedRatio,
} as const;
