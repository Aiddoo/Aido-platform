/** 가져올 일정의 출처. 새 출처(Google Calendar·Microsoft To Do·.ics)는 뒤에 더하고 앱은 모르는 값을 `.catch`로 받는다 */
export const TODO_IMPORT_SOURCES = ["DEVICE_CALENDAR"] as const;
export type TodoImportSource = (typeof TODO_IMPORT_SOURCES)[number];

/** TIME은 시각까지 가져와 리마인드 알림을 예약하고, DATE_ONLY는 날짜만 가져와 알림이 없다 */
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

/** 서버가 처리 중인 상태. 사용자마다 이 상태의 가져오기는 하나뿐이다 */
export const TODO_IMPORT_ACTIVE_STATUSES = [
  "UPLOADING",
  "QUEUED",
  "RUNNING",
  "UNDOING",
] as const satisfies readonly TodoImportStatus[];

/** 시작 요청에서 대상 카테고리를 거절한 이유 */
export const TODO_IMPORT_TARGET_REJECTION_REASONS = [
  "CAPACITY",
  "CATEGORY_NAME_TAKEN",
  "CATEGORY_NOT_FOUND",
] as const;
export type TodoImportTargetRejectionReason = (typeof TODO_IMPORT_TARGET_REJECTION_REASONS)[number];

/** 기간·항목 검증에서 거절한 이유 */
export const TODO_IMPORT_INVALID_REASONS = [
  "START_BEFORE_TODAY",
  "END_BEFORE_START",
  "ITEM_OUTSIDE_RANGE",
  "UNKNOWN_COLLECTION",
  "UNKNOWN_TARGET",
] as const;
export type TodoImportInvalidReason = (typeof TODO_IMPORT_INVALID_REASONS)[number];

export const TODO_IMPORT_LIMITS = {
  /** 가져오기 한 번에 받을 수 있는 일정 수 */
  MAX_ITEMS_PER_IMPORT: 3000,
  /** 업로드 요청 한 번의 일정 수. 최악의 제목 길이에서도 본문 100KB 안에 든다 */
  MAX_ITEMS_PER_CHUNK: 100,
  /** 고를 수 있는 캘린더 수이자 대상 카테고리 수 */
  MAX_COLLECTIONS: 20,
  /** 완료 뒤 되돌릴 수 있는 날 수 */
  UNDO_WINDOW_DAYS: 7,
  /** 기기가 sha256 hex로 만든 일정·캘린더 키 길이 */
  HASHED_KEY_LENGTH: 64,
  /** 앱이 고른 대상 카테고리를 요청 안에서 가리키는 값의 최대 길이 */
  TARGET_KEY_MAX_LENGTH: 64,
} as const;
