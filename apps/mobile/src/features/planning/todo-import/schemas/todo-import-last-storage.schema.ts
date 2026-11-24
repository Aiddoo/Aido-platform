import { defineStoredValue } from '@src/shared/storage/define-stored-value';

import { todoImportSchema } from '../domains/todo-import.model';

/** 마지막으로 시작한 가져오기. 결과 화면을 떠난 뒤에도 7일 안에 되돌리러 돌아올 길이다. 계정 저장소라 로그아웃 때 지워진다 */
export const lastTodoImportIdStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_todo_import_last_v1:${encodeURIComponent(accountId)}`,
  area: 'account',
  schema: todoImportSchema.shape.id,
  fallback: null,
});
