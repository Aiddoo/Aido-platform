export type TodoImportStep = 'permission' | 'calendars' | 'categories' | 'options';

/** 일정 수는 구간으로만 보낸다 */
export type TodoImportCountBucket = '0' | '1_10' | '11_50' | '51_200' | '201_1000' | '1001_plus';

export type TodoImportResumeTrigger = 'mount' | 'foreground' | 'online';

export type TodoImportFailureReason =
  | 'server_failed'
  | 'upload_rejected'
  | 'canceled'
  | 'abandoned';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    todo_import_step_viewed: { step: TodoImportStep };
    todo_import_permission_requested: { status: 'granted' | 'denied' | 'undetermined' };
    todo_import_created: {
      range_days: number;
      calendar_count: number;
      item_bucket: TodoImportCountBucket;
      time_mode: 'TIME' | 'DATE_ONLY';
      visibility: 'PUBLIC' | 'PRIVATE';
      new_category_count: number;
    };
    todo_import_completed: {
      created_bucket: TodoImportCountBucket;
      skipped_duplicate: number;
      skipped_capacity: number;
    };
    todo_import_failed: { reason: TodoImportFailureReason };
    todo_import_resume_requested: { trigger: TodoImportResumeTrigger };
    todo_import_cancel_completed: undefined;
    todo_import_undo_requested: undefined;
  }
}
