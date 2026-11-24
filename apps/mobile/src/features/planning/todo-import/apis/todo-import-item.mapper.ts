import type { TodoImportTimeMode } from '@aido/api/vocabulary';
import type { ImportEventRecord } from '@src/core/ports/todo-import-source';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import {
  getAllDayEndDate,
  getTimedDates,
  type ImportItem,
  normalizeImportTitle,
} from '../domains/todo-import-item.model';

interface ImportItemContext {
  /** 서버가 정한 가져오기 시간대(`todoImport.timezone`). 기기 시간대를 다시 읽지 않는다 */
  timezone: string;
  timeMode: TodoImportTimeMode;
  untitledTitle: string;
}

/** 기기 캘린더의 일정 회차 하나를 할 일 초안으로 바꾼다. 취소된 회차와 날짜를 읽을 수 없는 값은 null이다 */
export function toImportItem(
  record: ImportEventRecord,
  { timezone, timeMode, untitledTitle }: ImportItemContext,
): ImportItem | null {
  if (record.isCanceled) {
    return null;
  }
  const dates = match(record.time)
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
  if (dates == null) {
    return null;
  }

  return {
    sourceKey: record.occurrenceKey,
    collectionKey: record.collectionKey,
    title: normalizeImportTitle(record.title, untitledTitle),
    ...dates,
  };
}
