import { fromDate, type Instant, toDate } from '@src/shared/date/instant';

import { TodoPolicy } from '../domains/todo.model';
import type { Todo } from '../schemas/todo.schema';
import { parseInstantOrNull } from './parse-instant-or-null';

interface TodoScheduleValues {
  startDate: Instant;
  endDate: Instant | null;
  scheduledTime: string | null;
}

/** 일정 시트가 기본값으로 쓰는 날짜와 벽시계. 날짜는 달력 칸과 같은 그날 0시다 */
export function toTodoScheduleValues(
  todo: Pick<Todo, 'startDate' | 'endDate' | 'isAllDay' | 'localTime' | 'scheduledAt'>,
  timeZone: string,
): TodoScheduleValues {
  return {
    startDate: fromDate(toDate(todo.startDate)),
    endDate: parseInstantOrNull(todo.endDate),
    scheduledTime: TodoPolicy.getLocalTime(todo, timeZone),
  };
}
