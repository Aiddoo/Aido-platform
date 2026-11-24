import { useTodoImportSource } from '@src/bootstrap/providers/di-context';
import type { DateKey } from '@src/shared/date/date-key';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { getStartOfDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { queryOptions } from '@tanstack/react-query';
import { compact, orderBy } from 'es-toolkit';

import { toImportCollection } from '../apis/todo-import-collection.mapper';
import { toImportItem } from '../apis/todo-import-item.mapper';
import { countByCollection, filterByRange } from '../domains/todo-import-item.model';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';

export function useGetCalendarPermissionQueryOptions() {
  const todoImportSource = useTodoImportSource();

  return queryOptions({
    queryKey: TODO_IMPORT_QUERY_KEYS.calendarPermission(),
    queryFn: () => todoImportSource.getPermission(),
    // 기기 안에서만 읽어 연결 상태와 무관하다
    networkMode: 'always',
    // 설정 앱에서 허용하고 돌아올 수 있어 화면을 열거나 앱으로 돌아올 때마다 다시 본다
    staleTime: 0,
  });
}

/**
 * 캘린더 목록과 고른 기간 안의 가져올 일정 수. 기기 시간대로 센 미리보기이고,
 * 올릴 때는 서버가 정한 가져오기 시간대로 다시 읽는다
 */
export function useGetImportCollectionsQueryOptions({
  startDate,
  endDate,
}: {
  startDate: DateKey;
  endDate: DateKey;
}) {
  const todoImportSource = useTodoImportSource();
  const { timezone } = useDateFormatContext();

  return queryOptions({
    queryKey: TODO_IMPORT_QUERY_KEYS.calendarCollections({ startDate, endDate }),
    queryFn: async () => {
      const collections = await todoImportSource.listCollections();
      const records = await todoImportSource.readEvents({
        collectionKeys: collections.map((collection) => collection.collectionKey),
        startsAt: getStartOfDateKey(startDate, timezone),
        endsAt: getStartOfDateKey(addDaysToDateKey(endDate, 1), timezone),
      });
      const items = compact(
        records.map((record) =>
          toImportItem(record, { timezone, timeMode: 'DATE_ONLY', untitledTitle: '' }),
        ),
      );
      const itemCountByCollection = countByCollection(filterByRange(items, { startDate, endDate }));
      return orderBy(
        collections.map((record) => toImportCollection(record, itemCountByCollection)),
        [(collection) => collection.accountName ?? '', (collection) => collection.title],
        ['asc', 'asc'],
      );
    },
    networkMode: 'always',
    // 일정이 수천 개일 수 있어 같은 기간을 오가거나 앱으로 돌아와도 다시 읽지 않는다. 기간을 바꾸면 새로 읽는다
    staleTime: Number.POSITIVE_INFINITY,
  });
}
