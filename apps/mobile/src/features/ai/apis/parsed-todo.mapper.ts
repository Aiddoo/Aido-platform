import type { ParseTodoResponse } from '@aido/api';
import { toDate } from '@src/shared/utils/date';

import type { ParsedTodoResult } from '../domains/parsed-todo.model';

// 서버 DATE("YYYY-MM-DD")를 new Date로 읽으면 UTC 자정이 되어 미주 기기에서 하루 앞당겨진다.
export const toParsedTodoResult = (dto: ParseTodoResponse): ParsedTodoResult => ({
  data: {
    title: dto.data.title,
    startDate: toDate(dto.data.startDate),
    endDate: dto.data.endDate == null ? null : toDate(dto.data.endDate),
    scheduledTime: dto.data.scheduledTime,
    isAllDay: dto.data.isAllDay,
    isRecurring: dto.data.isRecurring,
    recurrence: dto.data.recurrence
      ? {
          daysOfWeek: dto.data.recurrence.daysOfWeek,
          endDate: toDate(dto.data.recurrence.endDate),
        }
      : null,
    ...(dto.data.categoryId != null && { categoryId: dto.data.categoryId }),
  },
  meta: dto.meta,
});
