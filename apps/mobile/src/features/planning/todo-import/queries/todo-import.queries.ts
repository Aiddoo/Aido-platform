import { useTodoImportApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';
import { noop } from 'es-toolkit';

import { TodoImportPolicy } from '../domains/todo-import.model';
import { getCachedTodoImport, settleTodoImportFinished } from './todo-import-cache';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';

/** 처리 중이면 앱이 앞에 있는 동안만 2~3초마다 다시 묻고, 끝나면 멈춘다(뒤에서는 기본값대로 묻지 않는다) */
export function useGetTodoImportQueryOptions({ importId }: { importId: string }) {
  const todoImportApi = useTodoImportApi();

  return queryOptions({
    queryKey: TODO_IMPORT_QUERY_KEYS.detail({ importId }),
    queryFn: async ({ signal, client }) => {
      const previous = getCachedTodoImport(client, importId);
      const todoImport = unwrap(await todoImportApi.getImport(importId, signal));
      // 다시 받기 실패는 조회 캐시가 보고하고, 이 응답은 기다리지 않고 보인다
      settleTodoImportFinished(client, { previous, next: todoImport })?.catch(noop);
      return todoImport;
    },
    refetchInterval: (query) =>
      query.state.data == null ? false : TodoImportPolicy.getPollIntervalMs(query.state.data),
  });
}

/** 설정 메뉴가 "가져오는 중"과 이어 볼 가져오기를 고른다 */
export function useGetActiveTodoImportQueryOptions() {
  const todoImportApi = useTodoImportApi();

  return queryOptions({
    queryKey: TODO_IMPORT_QUERY_KEYS.active(),
    queryFn: async ({ signal }) => unwrap(await todoImportApi.getActiveImport(signal)),
  });
}
