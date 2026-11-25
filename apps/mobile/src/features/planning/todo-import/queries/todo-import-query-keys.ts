import type { OsPermission } from '@src/core/ports/os-permission';
import type { DateKey } from '@src/shared/date/date-key';
import { queryOptions } from '@tanstack/react-query';

import type { ImportCollection } from '../domains/todo-import-collection.model';
import type { TodoImport } from '../domains/todo-import.model';

export const TODO_IMPORT_QUERY_KEYS = {
  all: ['todo-import'] as const,
  details: () => [...TODO_IMPORT_QUERY_KEYS.all, 'detail'] as const,
  detail: (params: { importId: string }) =>
    queryOptions<TodoImport>({ queryKey: [...TODO_IMPORT_QUERY_KEYS.details(), params] }).queryKey,
  active: () =>
    queryOptions<TodoImport | null>({ queryKey: [...TODO_IMPORT_QUERY_KEYS.all, 'active'] })
      .queryKey,
  /** 캘린더 권한·목록은 OS 상태라 `['device', …]`에 둬 가져오기 무효화에 휩쓸려 다시 읽지 않는다 */
  calendarPermission: () =>
    queryOptions<OsPermission>({ queryKey: ['device', 'calendar-permission'] }).queryKey,
  /** 기간을 기기 시간대로 잘라 세므로 시간대가 바뀌면 다시 센다 */
  calendarCollections: ({
    startDate,
    endDate,
    timezone,
  }: {
    startDate: DateKey;
    endDate: DateKey;
    timezone: string;
  }) =>
    queryOptions<ImportCollection[]>({
      queryKey: ['device', 'calendar-collections', { startDate, endDate, timezone }],
    }).queryKey,
} as const;
