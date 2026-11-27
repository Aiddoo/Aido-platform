import { defineStoredValue } from '@src/shared/storage/define-stored-value';

import { todoImportFeedEntryClosedReasonSchema } from '../domains/todo-import-feed-entry.model';

/** 할 일 탭의 캘린더 가져오기 카드를 다시 띄우지 않는 이유. 계정마다 한 칸이고 남으면 다시 띄우지 않는다 */
export const todoImportFeedEntryStoredValue = defineStoredValue({
  key: (userId: string) => `aido_todo_import_feed_entry_closed_v1:${userId}`,
  schema: todoImportFeedEntryClosedReasonSchema,
  fallback: null,
});
