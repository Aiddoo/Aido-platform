import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { z } from 'zod';

import { todoImportSchema } from '../domains/todo-import.model';

/**
 * 최근에 시작한 가져오기(새것이 앞). 결과 화면을 떠난 뒤에도 7일 안에 되돌리러 돌아올 길이다.
 * 되돌릴 수 없게 끝난 것은 빼고 그다음 것을 보인다. 계정 저장소라 로그아웃 때 지워진다
 */
export const lastTodoImportIdsStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_todo_import_last_v1:${encodeURIComponent(accountId)}`,
  area: 'account',
  schema: storedJsonSchema(z.array(todoImportSchema.shape.id)),
  fallback: [],
});
