// iOS 위젯 번들도 이 파일을 읽어 앱의 `@src` 별칭 없이 import가 없는 상수만 둔다

/** 가장 큰 위젯의 maxRows. iOS 위젯, 첫 props, 저장된 snapshot의 props가 같은 값으로 그린다 */
export const WIDGET_LARGE_MAX_ROWS = 4;

/** snapshot에 담는 할 일 수 상한(큰 위젯 기준). 저장된 snapshot도 같은 수로 읽어야 처음 모양으로 돌아가지 않는다 */
export const WIDGET_TOP_TODOS_LIMIT = 10;

export const ANDROID_WIDGET_DEFINITIONS = [
  { name: 'AidoTodaySummary', maxRows: 0 },
  { name: 'AidoTodayList', maxRows: 2 },
  { name: 'AidoTodayLarge', maxRows: WIDGET_LARGE_MAX_ROWS },
] as const;

export const ANDROID_WIDGET_STORAGE_KEYS = {
  // oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
  snapshot: 'aido_widget_snapshot_v1',
  // oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
  snapshotUserId: 'aido_widget_snapshot_user_id_v1',
} as const;

export const ANDROID_WIDGET_NAVIGATION_ACTION = 'AIDO_WIDGET_NAVIGATE';

export const WIDGET_BRAND_COLOR = '#FF6B43';

/** 위젯을 누른 뒤 앱이 이 시간 안에 열려야 저장된 목적지로 옮긴다 */
export const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;
