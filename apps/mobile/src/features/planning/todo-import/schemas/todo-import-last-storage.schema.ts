import { defineStoredValue, storedJsonSchema } from '@src/shared/storage/define-stored-value';
import { uniq } from 'es-toolkit';
import { z } from 'zod';

import { todoImportSchema } from '../domains/todo-import.model';

/** 다시 가져와도 아무것도 만들지 않은 가져오기가 앞의 되돌릴 수 있는 가져오기를 가리지 않을 만큼 남긴다 */
const MAX_REMEMBERED_IMPORT_COUNT = 3;

const todoImportIdSchema = todoImportSchema.shape.id;

/**
 * 최근에 시작한 가져오기(새것이 앞). 결과 화면을 떠난 뒤에도 7일 안에 되돌리러 돌아올 길이다.
 * 되돌릴 수 없게 끝난 것은 빼고 그다음 것을 보인다. 계정 저장소라 로그아웃 때 지워진다
 */
export const lastTodoImportIdsStoredValue = defineStoredValue({
  key: (accountId: string) => `aido_todo_import_last_v1:${encodeURIComponent(accountId)}`,
  area: 'account',
  schema: storedJsonSchema(z.array(todoImportIdSchema)),
  fallback: [],
  // 출시 전 QA 빌드는 마지막 id 하나를 문자열로 남겼다
  migrate: (raw) => (todoImportIdSchema.safeParse(raw).success ? [raw] : null),
});

export function rememberTodoImportId(ids: readonly string[], importId: string): string[] {
  return uniq([importId, ...ids]).slice(0, MAX_REMEMBERED_IMPORT_COUNT);
}
