import { defineStoredValue } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

/** 할 일 탭의 캘린더 가져오기 카드를 닫았다. 계정마다 한 칸이고 닫으면 다시 띄우지 않는다 */
export const todoImportFeedEntryDismissedStoredValue = defineStoredValue({
  key: (userId: string) => `aido_todo_import_feed_entry_dismissed_v1:${userId}`,
  schema: z.literal('dismissed'),
  fallback: null,
});
