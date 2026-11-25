import type { OsPermission } from '@src/core/ports/os-permission';
import { invalidateEntitlements } from '@src/features/billing/subscription/queries/entitlement-cache';
import { invalidateTodos } from '@src/features/planning/todo/queries/todo-cache';
import { getOsPermissionAccess } from '@src/shared/utils/get-os-permission-access';
import type { QueryClient } from '@tanstack/react-query';

import { type TodoImport, TodoImportPolicy } from '../domains/todo-import.model';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';

/**
 * Android는 묻기 전에는 영구 거절을 알려 주지 않아 읽으면 늘 다시 물을 수 있다고 나온다.
 * 이번 실행에서 받은 "다시 묻지 않음" 답은 허용되기 전까지 남겨 다시 들어와도 설정 열기를 보인다
 */
export function keepBlockedCalendarPermission(
  previous: OsPermission | undefined,
  read: OsPermission,
): OsPermission {
  if (previous == null || getOsPermissionAccess(previous) !== 'settings') {
    return read;
  }
  return getOsPermissionAccess(read) === 'granted' ? read : previous;
}

export function getCachedTodoImport(queryClient: QueryClient, importId: string) {
  return queryClient.getQueryData(TODO_IMPORT_QUERY_KEYS.detail({ importId })) ?? null;
}

export function setTodoImportInCache(queryClient: QueryClient, todoImport: TodoImport) {
  queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.detail({ importId: todoImport.id }), todoImport);
}

export function setCachedCalendarPermission(queryClient: QueryClient, permission: OsPermission) {
  queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.calendarPermission(), permission);
}

export function invalidateTodoImport(queryClient: QueryClient, importId: string) {
  return queryClient.invalidateQueries({ queryKey: TODO_IMPORT_QUERY_KEYS.detail({ importId }) });
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
