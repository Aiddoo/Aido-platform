export const ANDROID_WIDGET_DEFINITIONS = [
  { name: 'AidoTodaySummary', maxRows: 0 },
  { name: 'AidoTodayList', maxRows: 2 },
  { name: 'AidoTodayLarge', maxRows: 4 },
] as const;

export const ANDROID_WIDGET_STORAGE_KEYS = {
  snapshot: 'aido_widget_snapshot_v1',
  snapshotUserId: 'aido_widget_snapshot_user_id_v1',
} as const;

export const ANDROID_WIDGET_NAVIGATION_ACTION = 'AIDO_WIDGET_NAVIGATE';
