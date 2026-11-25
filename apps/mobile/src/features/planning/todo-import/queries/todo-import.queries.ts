import { useTodoImportApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { queryOptions } from '@tanstack/react-query';
import { noop } from 'es-toolkit';

import type { TodoImport } from '../domains/todo-import.model';
import { getCachedTodoImport, settleTodoImportFinished } from './todo-import-cache';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';

// 업로드·대기는 서버 잡을 기다리는 동안이라 느리게, 만들기·되돌리기는 막대가 움직이니 빠르게 묻는다. 끝나면 멈춘다
const POLL_INTERVAL_MS = {
  UPLOADING: 3 * SECOND_MS,
  QUEUED: 3 * SECOND_MS,
  RUNNING: 2 * SECOND_MS,
  UNDOING: 2 * SECOND_MS,
  COMPLETED: false,
  FAILED: false,
  CANCELED: false,
  ABANDONED: false,
  UNDONE: false,
} as const satisfies Record<TodoImport['status'], number | false>;

// 이 기기의 시작·취소·끝남은 바로 무효화한다. 다른 기기에서 시작한 가져오기만 이 간격으로 알게 된다
const ACTIVE_TODO_IMPORT_STALE_TIME_MS = 30 * MINUTE_MS;

interface TodoImportQueryInput {
  importId: string;
}

// 가져오기가 있을 때만 조회를 거는 곳(useQueries)의 옵션. 처리 중이면 앱이 앞에 있는 동안만 2~3초마다 다시 묻는다(뒤에서는 기본값대로 묻지 않는다)
export function useGetTodoImportQueryOptionsFactory() {
  const todoImportApi = useTodoImportApi();

  return ({ importId }: TodoImportQueryInput) =>
    queryOptions({
      queryKey: TODO_IMPORT_QUERY_KEYS.detail({ importId }),
      queryFn: async ({ signal, client }) => {
        const previous = getCachedTodoImport(client, importId);
        const todoImport = unwrap(await todoImportApi.getImport(importId, signal));
        // 다시 받기 실패는 조회 캐시가 보고하고, 이 응답은 기다리지 않고 보인다
        settleTodoImportFinished(client, { previous, next: todoImport })?.catch(noop);
        return todoImport;
      },
      refetchInterval: (query) =>
        query.state.data == null ? false : POLL_INTERVAL_MS[query.state.data.status],
    });
}

export function useGetTodoImportQueryOptions({ importId }: TodoImportQueryInput) {
  const getTodoImportQueryOptions = useGetTodoImportQueryOptionsFactory();

  return getTodoImportQueryOptions({ importId });
}

export function useGetActiveTodoImportQueryOptions() {
  const todoImportApi = useTodoImportApi();

  return queryOptions({
    queryKey: TODO_IMPORT_QUERY_KEYS.active(),
    queryFn: async ({ signal }) => unwrap(await todoImportApi.getActiveImport(signal)),
    staleTime: ACTIVE_TODO_IMPORT_STALE_TIME_MS,
  });
}
