import type { ParseTodoResponse } from '@aido/api';

import type { ParsedTodoResult } from '../domains/parsed-todo.model';

export const toParsedTodoResult = (dto: ParseTodoResponse): ParsedTodoResult => ({
  data: {
    title: dto.data.title,
    startDate: new Date(dto.data.startDate),
    endDate: dto.data.endDate ? new Date(dto.data.endDate) : null,
    scheduledTime: dto.data.scheduledTime,
    isAllDay: dto.data.isAllDay,
    isRecurring: dto.data.isRecurring,
    recurrence: dto.data.recurrence
      ? {
          daysOfWeek: dto.data.recurrence.daysOfWeek,
          endDate: new Date(dto.data.recurrence.endDate),
        }
      : null,
    ...(dto.data.categoryId != null && { categoryId: dto.data.categoryId }),
  },
  meta: dto.meta,
});
