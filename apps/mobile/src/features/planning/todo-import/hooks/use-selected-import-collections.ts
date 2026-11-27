import { useQuery } from '@tanstack/react-query';

import {
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import type { TodoImportRange } from '../domains/todo-import-range.model';
import { useGetImportCollectionsQueryOptions } from '../queries/todo-import-source.queries';

interface SelectedImportCollectionsInput extends TodoImportRange {
  /** 고른 캘린더 키. null은 기본 선택이다 */
  selectedKeys: readonly string[] | null;
}

// 캘린더 목록과 같은 조회를 기다리지 않고 읽어, 받는 동안과 실패했을 때는 고른 캘린더가 없다(오류와 다시 시도는 목록의 경계가 보인다)
export function useSelectedImportCollections({
  startDate,
  endDate,
  selectedKeys,
}: SelectedImportCollectionsInput): TodoImportCollection[] {
  const { data: collections } = useQuery(
    useGetImportCollectionsQueryOptions({ startDate, endDate }),
  );

  return TodoImportCollectionPolicy.getSelectedCollections(collections ?? [], selectedKeys);
}
