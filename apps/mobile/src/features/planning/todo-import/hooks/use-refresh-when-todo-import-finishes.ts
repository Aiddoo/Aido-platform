import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { useStoredValue } from '@src/shared/storage/use-stored-value';
import { queryOptions, useQueries } from '@tanstack/react-query';
import { noop, take } from 'es-toolkit';

import { TodoImportPolicy } from '../domains/todo-import.model';
import { useGetTodoImportQueryOptionsFactory } from '../queries/todo-import.queries';
import { lastTodoImportIdsStoredValue } from '../schemas/todo-import-last-storage.schema';

/**
 * 진행 화면을 떠난 사이 가져오기가 끝나도 할 일·카테고리·한도를 한 번 다시 받는다. 이 기기가 시작해 캐시에
 * 처리 중으로 남은 가져오기만 앱이 앞에 있는 동안 진행 화면과 같은 간격으로 묻고, 끝나면 멈춘다.
 * 다시 받기는 조회 queryFn의 `settleTodoImportFinished`가 한다
 */
export function useRefreshWhenTodoImportFinishes(): void {
  const accountId = useMyAccountId();
  const [lastImportIds] = useStoredValue(lastTodoImportIdsStoredValue, accountId);
  const getTodoImportQueryOptions = useGetTodoImportQueryOptionsFactory();

  // 가장 최근에 시작한 가져오기 하나만 본다. 시작한 적이 없으면 조회도 없다. 진행 화면이 열려 있으면 같은 조회를 함께 쓴다
  useQueries({
    queries: take(lastImportIds, 1).map((importId) =>
      queryOptions({
        ...getTodoImportQueryOptions({ importId }),
        enabled: (query) =>
          query.state.data != null && !TodoImportPolicy.isTerminal(query.state.data),
      }),
    ),
    // 결과를 읽지 않아 받을 때마다 앱 묶음을 다시 그리지 않는다
    combine: noop,
  });
}
