import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import { type Todo, TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { DateKey } from '@src/shared/date/date-key';
import { toZonedInstant } from '@src/shared/date/zoned';

import type { WeatherBriefingTodo } from '../domains/weather-briefing.model';

/**
 * 오늘 목록의 할 일을 브리핑이 쓰는 값으로 바꾼다. 여러 날 할 일은 시작일이 어제여도 오늘 목록에 있어
 * 보고 있는 날짜 + 벽시계 + 기기 시간대로 시각을 만든다
 */
export function toWeatherBriefingTodo(
  todo: Todo,
  { date, timezone }: { date: DateKey; timezone: string },
): WeatherBriefingTodo {
  const localTime = TodoPolicy.findLocalTime(todo, timezone);
  return {
    id: todo.id,
    title: todo.title,
    localTime,
    scheduledAt: localTime == null ? null : toZonedInstant({ date, time: localTime, timezone }),
    completed: todo.completed,
    subTodoProgress: SubTodoPolicy.hasSubTodos(todo.subTodos)
      ? SubTodoPolicy.getSubTodoStats(todo.subTodos)
      : null,
  };
}
