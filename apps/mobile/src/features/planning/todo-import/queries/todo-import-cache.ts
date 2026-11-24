import type { OsPermission } from '@src/core/ports/os-permission';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import type { QueryClient } from '@tanstack/react-query';

import { type TodoImport, TodoImportPolicy } from '../domains/todo-import.model';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';

export function getCachedTodoImport(queryClient: QueryClient, importId: string) {
  return queryClient.getQueryData(TODO_IMPORT_QUERY_KEYS.detail({ importId })) ?? null;
}

export function setTodoImportInCache(queryClient: QueryClient, todoImport: TodoImport) {
  queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.detail({ importId: todoImport.id }), todoImport);
}

export function setCachedCalendarPermission(queryClient: QueryClient, permission: OsPermission) {
  queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.calendarPermission(), permission);
}

export function invalidateActiveTodoImport(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_IMPORT_QUERY_KEYS.active() });
}

/**
 * 처리 중이던 가져오기가 처음 끝난 상태로 바뀌면 한 번만 할 일(목록·달력·완료·카테고리)과 한도를 다시 받는다.
 * 진행 중에는 다시 받지 않아 주간·월간 달력과 이웃 달 미리 받기가 가져오는 동안 수백 번 돌지 않는다
 */
export function settleTodoImportFinished(
  queryClient: QueryClient,
  { previous, next }: { previous: TodoImport | null; next: TodoImport },
): Promise<unknown> | null {
  if (previous == null || TodoImportPolicy.isTerminal(previous)) {
    return null;
  }
  if (!TodoImportPolicy.isTerminal(next)) {
    return null;
  }
  return Promise.all([
    invalidateTodos(queryClient),
    invalidateEntitlements(queryClient),
    invalidateActiveTodoImport(queryClient),
  ]);
}
