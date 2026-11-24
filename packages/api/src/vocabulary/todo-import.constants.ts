/** 출처는 추가만 한다. 앱은 모르는 값을 `.catch`로 받는다 */
export const TODO_IMPORT_SOURCES = ["DEVICE_CALENDAR"] as const;
export type TodoImportSourceKind = (typeof TODO_IMPORT_SOURCES)[number];

/** DATE_ONLY는 시각을 버려 리마인드 알림이 예약되지 않는다 */
export const TODO_IMPORT_TIME_MODES = ["TIME", "DATE_ONLY"] as const;
export type TodoImportTimeMode = (typeof TODO_IMPORT_TIME_MODES)[number];

export const TODO_IMPORT_TARGET_KINDS = ["NEW_CATEGORY", "EXISTING_CATEGORY"] as const;
export type TodoImportTargetKind = (typeof TODO_IMPORT_TARGET_KINDS)[number];

export const TODO_IMPORT_STATUSES = [
  "UPLOADING",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "ABANDONED",
  "UNDOING",
  "UNDONE",
] as const;
export type TodoImportStatus = (typeof TODO_IMPORT_STATUSES)[number];

/** 사용자마다 이 상태의 가져오기는 하나뿐이다 */
export const TODO_IMPORT_ACTIVE_STATUSES = [
  "UPLOADING",
  "QUEUED",
  "RUNNING",
  "UNDOING",
] as const satisfies readonly TodoImportStatus[];

/** FAILED가 된 이유. 만들다 멈춤, 진행이 오래 멈춰 닫음, 되돌리다 멈춤 */
export const TODO_IMPORT_FAILURE_REASONS = [
  "MATERIALIZATION_FAILED",
  "STALLED",
  "UNDO_FAILED",
] as const;
export type TodoImportFailureReason = (typeof TODO_IMPORT_FAILURE_REASONS)[number];

export const TODO_IMPORT_TARGET_REJECTION_REASONS = [
  "CAPACITY",
  "CATEGORY_NAME_TAKEN",
  "CATEGORY_NOT_FOUND",
] as const;
export type TodoImportTargetRejectionReason = (typeof TODO_IMPORT_TARGET_REJECTION_REASONS)[number];

export const TODO_IMPORT_INVALID_REASONS = [
  "START_BEFORE_TODAY",
  "END_BEFORE_START",
  "ITEM_OUTSIDE_RANGE",
  "UNKNOWN_COLLECTION",
  "UNKNOWN_TARGET",
] as const;
export type TodoImportInvalidReason = (typeof TODO_IMPORT_INVALID_REASONS)[number];

export const TODO_IMPORT_LIMITS = {
  MAX_ITEMS_PER_IMPORT: 3000,
  /** 최악의 제목 길이에서도 요청 본문이 100KB 안에 든다 */
  MAX_ITEMS_PER_CHUNK: 100,
  MAX_COLLECTIONS: 20,
  UNDO_WINDOW_DAYS: 7,
  HASHED_KEY_LENGTH: 64,
  TARGET_KEY_MAX_LENGTH: 64,
} as const;
