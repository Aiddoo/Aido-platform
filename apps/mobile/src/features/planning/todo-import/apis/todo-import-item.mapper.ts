import type { TodoImportTimeMode } from '@aido/api/vocabulary';
import type { ImportEventPreview, ImportEventRecord } from '@src/core/ports/todo-import-source';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import {
  getAllDayEndDate,
  getTimedDates,
  normalizeImportTitle,
  type TodoImportItem,
  type TodoImportItemPreview,
} from '../domains/todo-import-item.model';

interface TodoImportItemContext {
  // 서버가 정한 가져오기 시간대(todoImport.timezone). 기기 시간대를 다시 읽지 않는다
  timezone: string;
  timeMode: TodoImportTimeMode;
}

interface TitledTodoImportItemContext extends TodoImportItemContext {
  untitledTitle: string;
}

// 일정 수를 셀 때 쓴다. 취소된 회차와 날짜를 읽을 수 없는 값은 null이다
export function toTodoImportItemPreview(
  preview: ImportEventPreview,
  { timezone, timeMode }: TodoImportItemContext,
): TodoImportItemPreview | null {
  if (preview.isCanceled) {
    return null;
  }
  const dates = match(preview.time)
    .with({ kind: 'allDay' }, ({ startDate, endDateExclusive }) => {
      const start = dateKeySchema.safeParse(startDate);
      const endExclusive = dateKeySchema.safeParse(endDateExclusive);
      if (!start.success || !endExclusive.success) {
        return null;
      }
      return {
        startDate: start.data,
        endDate: getAllDayEndDate(start.data, endExclusive.data),
        localTime: null,
      };
    })
    .with({ kind: 'timed' }, ({ startsAt }) => {
      const start = instantSchema.safeParse(startsAt);
      return start.success
        ? { ...getTimedDates(start.data, { timezone, timeMode }), endDate: null }
        : null;
    })
    .exhaustive();

  return dates == null ? null : { collectionKey: preview.collectionKey, ...dates };
}

// 취소된 회차와 날짜를 읽을 수 없는 값은 null이다
export function toTodoImportItem(
  record: ImportEventRecord,
  { untitledTitle, ...context }: TitledTodoImportItemContext,
): TodoImportItem | null {
  const preview = toTodoImportItemPreview(record, context);
  if (preview == null) {
    return null;
  }

  return {
    sourceKey: record.occurrenceKey,
    title: normalizeImportTitle(record.title, untitledTitle),
    ...preview,
  };
}
