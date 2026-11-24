import { TODO_IMPORT_STATUSES, type TodoImportStatus } from "@aido/api/vocabulary";

// drizzle-kit이 schema에서 이 파일을 읽어 #api 별칭 없이 둔다
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** 받은 일정 하나가 할 일 만들기에서 어떻게 끝났는지. PENDING만 아직 처리할 일이다 */
export const TODO_IMPORT_ITEM_STATUSES = [
  "PENDING",
  "CREATED",
  "SKIPPED_DUPLICATE",
  "SKIPPED_CAPACITY",
  "SKIPPED_CATEGORY_MISSING",
  "SKIPPED_INVALID",
] as const;

export type TodoImportItemStatus = (typeof TODO_IMPORT_ITEM_STATUSES)[number];

export type TodoImportItemOutcome = Exclude<TodoImportItemStatus, "PENDING">;

export const TODO_IMPORT_FAILURE_REASONS = [
  "MATERIALIZATION_FAILED",
  "UNDO_FAILED",
  "STALLED",
] as const;

export type TodoImportFailureReason = (typeof TODO_IMPORT_FAILURE_REASONS)[number];

/** 잡이 할 일을 만들거나 지우는 중인 상태. 재조정자가 진행이 멈췄는지 본다 */
export const TODO_IMPORT_WORKING_STATUSES = [
  "QUEUED",
  "RUNNING",
  "UNDOING",
] as const satisfies readonly TodoImportStatus[];

/** 더 바뀌지 않는 상태. 임시 항목과 기록을 보관 기간 뒤에 지운다 */
export const TODO_IMPORT_ENDED_STATUSES = TODO_IMPORT_STATUSES.filter(
  (status) =>
    status !== "UPLOADING" && !TODO_IMPORT_WORKING_STATUSES.some((working) => working === status),
);

export const TODO_IMPORT_MATERIALIZATION = {
  BATCH_SIZE: 100,
  // round 하나가 이만큼 일하면 다음 round로 큐 뒤에 다시 서서 다른 사용자의 가져오기와 번갈아 돈다
  ROUND_MAX_ITEMS: 1000,
  ROUND_MAX_DURATION_MS: 60 * SECOND_MS,
} as const;

export const TODO_IMPORT_UNDO = {
  BATCH_SIZE: 200,
  ROUND_MAX_ITEMS: 1000,
  ROUND_MAX_DURATION_MS: 60 * SECOND_MS,
} as const;

export const TODO_IMPORT_RECOVERY = {
  STALLED_AFTER_MS: 10 * MINUTE_MS,
  MAX_RECOVERY_COUNT: 3,
  UPLOAD_ABANDONED_AFTER_MS: DAY_MS,
} as const;

export const TODO_IMPORT_RETENTION = {
  ITEMS_AFTER_END_MS: 7 * DAY_MS,
  IMPORTS_AFTER_END_MS: 30 * DAY_MS,
  PURGE_BATCH_SIZE: 500,
} as const;
