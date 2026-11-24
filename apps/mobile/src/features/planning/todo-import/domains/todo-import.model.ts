import {
  TODO_IMPORT_SOURCE_UNKNOWN,
  TODO_IMPORT_SOURCES,
  TODO_IMPORT_STATUSES,
  TODO_IMPORT_TIME_MODES,
  TODO_VISIBILITIES,
} from '@aido/api/vocabulary';
import { addDaysToDateKey, type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import { hasInstantPassed, type Instant, instantSchema } from '@src/shared/date/instant';
import { clamp, sum } from 'es-toolkit';
import { match, P } from 'ts-pattern';
import { z } from 'zod';

const countSchema = z.int().nonnegative();

/** 서버가 처리하는 가져오기 한 건. 상태·수·되돌리기 기한은 서버가 정하고 앱은 읽기만 한다 */
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

/** 서버 요금제 기간(`CALENDAR_IMPORT.limit`)으로 가져올 수 있는 마지막 날. null은 기간 제한이 없다 */
export function findLastAllowedDate(todayKey: DateKey, horizonDays: number | null): DateKey | null {
  return horizonDays == null ? null : getRangeEndDate(todayKey, horizonDays);
}

/** 오늘 이전은 할 일로 가져오지 않는다 */
export function canImportFrom(startDate: DateKey, todayKey: DateKey) {
  return todayKey <= startDate;
}

/** 오늘부터 요금제 기간 안의 날까지 가져온다 */
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

/** 사용자마다 하나뿐인 처리 중 가져오기(서버 `TODO_IMPORT_ACTIVE_STATUSES`) */
function isActive(todoImport: TodoImport) {
  return !isTerminal(todoImport);
}

function canUndo(todoImport: TodoImport, now: Instant) {
  return (
    todoImport.status === 'COMPLETED' &&
    todoImport.undoableUntil != null &&
    !hasInstantPassed(todoImport.undoableUntil, now)
  );
}

/** 확정 전(업로드 중)에만 멈출 수 있다. 확정 뒤에는 서버 잡이 끝까지 만든다 */
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

function hasSkipped(todoImport: TodoImport) {
  const { skippedDuplicate, skippedCapacity, skippedCategoryMissing, skippedInvalid } =
    todoImport.counts;
  return sum([skippedDuplicate, skippedCapacity, skippedCategoryMissing, skippedInvalid]) > 0;
}

/** 서버가 만든 할 일까지 처리한 비율(0~1). 받은 수가 없으면 0이다 */
function calculateProcessedRatio(todoImport: TodoImport) {
  const total = Math.max(todoImport.receivedItemCount, todoImport.expectedItemCount);
  return total === 0 ? 0 : clamp(todoImport.processedItemCount / total, 0, 1);
}

export const TodoImportPolicy = {
  isTerminal,
  isActive,
  canUndo,
  canCancel,
  getPollIntervalMs,
  hasSkipped,
  calculateProcessedRatio,
} as const;
