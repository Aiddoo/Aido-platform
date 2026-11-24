import type { TodoImportTimeMode } from '@aido/api/vocabulary';
import type { ImportEventPreview, ImportEventRecord } from '@src/core/ports/todo-import-source';
import { dateKeySchema } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { match } from 'ts-pattern';

import {
  getAllDayEndDate,
  getTimedDates,
  type ImportItem,
  type ImportItemPreview,
  normalizeImportTitle,
} from '../domains/todo-import-item.model';

interface ImportItemContext {
  /** 서버가 정한 가져오기 시간대(`todoImport.timezone`). 기기 시간대를 다시 읽지 않는다 */
  timezone: string;
  timeMode: TodoImportTimeMode;
}

/** 일정 수를 셀 때 쓴다. 취소된 회차와 날짜를 읽을 수 없는 값은 null이다 */
export function toImportItemPreview(
  preview: ImportEventPreview,
  { timezone, timeMode }: ImportItemContext,
): ImportItemPreview | null {
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

/** 취소된 회차와 날짜를 읽을 수 없는 값은 null이다 */
export function toImportItem(
  record: ImportEventRecord,
  { untitledTitle, ...context }: ImportItemContext & { untitledTitle: string },
): ImportItem | null {
  const preview = toImportItemPreview(record, context);
  if (preview == null) {
    return null;
  }

  return {
    sourceKey: record.occurrenceKey,
    title: normalizeImportTitle(record.title, untitledTitle),
    ...preview,
  };
}
