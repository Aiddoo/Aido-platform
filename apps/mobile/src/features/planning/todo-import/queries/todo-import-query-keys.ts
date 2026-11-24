import type { OsPermission } from '@src/core/ports/os-permission';
import type { DateKey } from '@src/shared/date/date-key';
import { queryOptions } from '@tanstack/react-query';

import type { ImportCollection } from '../domains/todo-import-collection.model';
import type { TodoImport } from '../domains/todo-import.model';

export const TODO_IMPORT_QUERY_KEYS = {
  all: ['todo-import'] as const,
  detail: ({ importId }: { importId: string }) =>
    queryOptions<TodoImport>({ queryKey: [...TODO_IMPORT_QUERY_KEYS.all, 'detail', { importId }] })
      .queryKey,
  active: () =>
    queryOptions<TodoImport | null>({ queryKey: [...TODO_IMPORT_QUERY_KEYS.all, 'active'] })
      .queryKey,
  /** 캘린더 권한·목록은 OS 상태라 `['device', …]`에 둬 가져오기 무효화에 휩쓸려 다시 읽지 않는다 */
  calendarPermission: () =>
    queryOptions<OsPermission>({ queryKey: ['device', 'calendar-permission'] }).queryKey,
  /** 기간이 바뀔 때만 캘린더를 다시 읽는다. 목록과 기간 안 일정 수를 한 번에 읽는다 */
  calendarCollections: ({ startDate, endDate }: { startDate: DateKey; endDate: DateKey }) =>
    queryOptions<ImportCollection[]>({
      queryKey: ['device', 'calendar-collections', { startDate, endDate }],
    }).queryKey,
} as const;
