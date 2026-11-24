import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';

import { todoImportSessionSchema } from '../domains/todo-import-session.model';

/** 계정 저장소라 로그아웃 때 함께 지워진다. 일정 제목은 담지 않는다 */
export const todoImportSessionStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_todo_import_session_v1:${encodeURIComponent(accountId)}`,
  area: 'account',
  schema: storedJsonSchema(todoImportSessionSchema),
  fallback: null,
});
