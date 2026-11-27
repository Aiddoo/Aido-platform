import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import { todoImportSchema } from '../domains/todo-import.model';

/** 결과 화면을 떠난 뒤에도 7일 안에 되돌리러 돌아올 길이다(새것이 앞). 계정 저장소라 로그아웃 때 지워진다 */
export const lastTodoImportIdsStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_todo_import_last_v1:${encodeURIComponent(accountId)}`,
  area: 'account',
  schema: storedJsonSchema(z.array(todoImportSchema.shape.id)),
  fallback: [],
});
