import { useSuspenseQuery } from '@tanstack/react-query';

import type { TodoImport } from '../domains/todo-import.model';
import { useGetTodoImportQueryOptions } from '../queries/todo-import.queries';
import { useTodoImportId } from './use-todo-import-params';

/** 지금 화면의 가져오기. 진행·결과 조각과 같은 키를 읽어 요청은 한 번이다 */
export function useSuspenseTodoImport(): TodoImport {
  const [importId] = useTodoImportId();
  const { data: todoImport } = useSuspenseQuery(useGetTodoImportQueryOptions({ importId }));

  return todoImport;
}
