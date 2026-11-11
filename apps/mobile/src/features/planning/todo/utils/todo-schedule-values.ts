import { fromDate, type Instant, toDate } from '@src/shared/date/instant';

import { TodoPolicy } from '../domains/todo.model';
import type { Todo } from '../domains/todo.model';
import { parseInstant } from './parse-instant';

interface TodoScheduleValues {
  startDate: Instant;
  endDate: Instant | null;
  scheduledTime: string | null;
}

/** 일정 시트가 기본값으로 쓰는 날짜와 벽시계. 날짜는 달력 칸과 같은 그날 0시다 */
export function toTodoScheduleValues(todo: Todo, timeZone: string): TodoScheduleValues {
  return {
    startDate: fromDate(toDate(todo.startDate)),
    endDate: parseInstant(todo.endDate),
    scheduledTime: TodoPolicy.getLocalTime(todo, timeZone),
  };
}
