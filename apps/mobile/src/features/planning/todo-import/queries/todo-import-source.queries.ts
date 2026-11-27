import { useTodoImportSource } from '@src/bootstrap/providers/di-context';
import { OS_PERMISSION_QUERY_OPTIONS } from '@src/shared/constants/os-permission-query';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { getStartOfDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { queryOptions } from '@tanstack/react-query';
import { compact, groupBy, orderBy, partition, sortBy } from 'es-toolkit';

import { toTodoImportCollection } from '../apis/todo-import-collection.mapper';
import { toTodoImportItemPreview } from '../apis/todo-import-item.mapper';
import {
  orderByAccountProvider,
  type TodoImportCollection,
  TodoImportCollectionPolicy,
} from '../domains/todo-import-collection.model';
import { TodoImportItemPolicy } from '../domains/todo-import-item.model';
import type { TodoImportRange } from '../domains/todo-import-range.model';
import { keepBlockedCalendarPermission } from './todo-import-cache';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';

interface TodoImportAccountGroup {
  accountKey: string;
  // 계정 이름·종류를 읽는 첫 캘린더
  account: TodoImportCollection;
  collections: TodoImportCollection[];
}

interface TodoImportCollectionsByAccount {
  collections: TodoImportCollection[];
  accounts: TodoImportAccountGroup[];
  receivedCollections: TodoImportCollection[];
}

// 기기 설정 앱과 같은 계정·이름 순이다
export function selectOrderedCollections(
  collections: readonly TodoImportCollection[],
): TodoImportCollection[] {
  return orderBy(
    collections,
    [(collection) => TodoImportCollectionPolicy.getAccountKey(collection), ({ title }) => title],
    ['asc', 'asc'],
  );
}

// 공휴일·생일·구독처럼 받아 보기만 하는 캘린더는 계정과 상관없이 맨 아래 한 묶음으로 따로 둔다
export function selectCollectionsByAccount(
  unordered: readonly TodoImportCollection[],
): TodoImportCollectionsByAccount {
  const collections = selectOrderedCollections(unordered);
  const [receivedCollections, ownCollections] = partition(collections, (collection) =>
    TodoImportCollectionPolicy.isReceivedCalendar(collection),
  );
  const accounts = Object.entries(
    groupBy(ownCollections, (collection) => TodoImportCollectionPolicy.getAccountKey(collection)),
  ).flatMap(([accountKey, group]) => {
    const [account] = group;
    return account == null ? [] : [{ accountKey, account, collections: group }];
  });

  return {
    collections,
    accounts: sortBy(accounts, [({ account }) => orderByAccountProvider(account)]),
    receivedCollections,
  };
}

export function useGetCalendarPermissionQueryOptions() {
  const todoImportSource = useTodoImportSource();

  return queryOptions({
    queryKey: TODO_IMPORT_QUERY_KEYS.calendarPermission(),
    queryFn: async ({ client, queryKey }) =>
      keepBlockedCalendarPermission(
        client.getQueryData(queryKey),
        await todoImportSource.getPermission(),
      ),
    ...OS_PERMISSION_QUERY_OPTIONS,
    // 받은 "다시 묻지 않음" 답을 이번 실행 동안 남긴다
    gcTime: Number.POSITIVE_INFINITY,
  });
}

// 기기 시간대로 센 미리보기이고, 올릴 때는 서버가 정한 가져오기 시간대로 다시 읽는다
export function useGetImportCollectionsQueryOptions({ startDate, endDate }: TodoImportRange) {
  const todoImportSource = useTodoImportSource();
  const { timezone } = useDateFormatContext();

  return queryOptions({
    queryKey: TODO_IMPORT_QUERY_KEYS.calendarCollections({ startDate, endDate, timezone }),
    queryFn: async () => {
      const collections = await todoImportSource.listCollections();
      // 수만 세므로 제목·회차 키(해시)는 읽지 않는다. 해시는 고른 캘린더를 올릴 때만 만든다
      const previews = await todoImportSource.previewEvents({
        collectionKeys: collections.map((collection) => collection.collectionKey),
        startsAt: getStartOfDateKey(startDate, timezone),
        endsAt: getStartOfDateKey(addDaysToDateKey(endDate, 1), timezone),
      });
      const items = compact(
        previews.map((preview) =>
          toTodoImportItemPreview(preview, { timezone, timeMode: 'DATE_ONLY' }),
        ),
      );
      const itemCountByCollection = TodoImportItemPolicy.calculateCountByCollection(
        TodoImportItemPolicy.filterByRange(items, { startDate, endDate }),
      );
      return collections.map((record) => toTodoImportCollection(record, itemCountByCollection));
    },
    select: selectOrderedCollections,
    networkMode: 'always',
    // 일정이 수천 개일 수 있어 같은 기간을 오가도 다시 읽지 않고, 설정 앱에서 돌아오면 목록을 보인 채 뒤에서 다시 읽는다
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: 'always',
  });
}
