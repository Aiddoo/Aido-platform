import type { TodoRepeat as TodoRepeatDto, TodoRepeatEnd as TodoRepeatEndDto } from '@aido/api';
import { DAYS_OF_WEEK } from '@aido/api/vocabulary';
import { type DateKey, dateKeySchema } from '@src/shared/date/date-key';
import { getDateKeyDayOfWeek } from '@src/shared/date/day-of-week';
import { match } from 'ts-pattern';

import { TODO_REPEAT_DEFAULT_COUNT } from '../constants/todo-repeat.constants';
import type { TodoRepeat, TodoRepeatEnd } from '../domains/todo-repeat.model';
import type { TodoRepeatFormValues } from '../schemas/todo-repeat-form.schema';

function toRepeatEnd(end: TodoRepeatEndDto): TodoRepeatEnd {
  return match(end)
    .returnType<TodoRepeatEnd>()
    .with({ type: 'NEVER' }, () => ({ type: 'NEVER' }))
    .with({ type: 'UNTIL' }, ({ date }) => ({ type: 'UNTIL', date: dateKeySchema.parse(date) }))
    .with({ type: 'COUNT' }, ({ count }) => ({ type: 'COUNT', count }))
    .exhaustive();
}

export function toRepeat(dto: TodoRepeatDto): TodoRepeat {
  return match(dto)
    .returnType<TodoRepeat>()
    .with({ frequency: 'DAILY' }, ({ end }) => ({ frequency: 'DAILY', end: toRepeatEnd(end) }))
    .with({ frequency: 'WEEKLY' }, ({ interval, weekdays, end }) => ({
      frequency: 'WEEKLY',
      interval,
      weekdays: [...weekdays],
      end: toRepeatEnd(end),
    }))
    .with({ frequency: 'MONTHLY' }, ({ monthDay, end }) => ({
      frequency: 'MONTHLY',
      monthDay,
      end: toRepeatEnd(end),
    }))
    .exhaustive();
}

function toRepeatEndDto(end: TodoRepeatEnd): TodoRepeatEndDto {
  return match(end)
    .returnType<TodoRepeatEndDto>()
    .with({ type: 'NEVER' }, () => ({ type: 'NEVER' }))
    .with({ type: 'UNTIL' }, ({ date }) => ({ type: 'UNTIL', date }))
    .with({ type: 'COUNT' }, ({ count }) => ({ type: 'COUNT', count }))
    .exhaustive();
}

export function toRepeatDto(repeat: TodoRepeat): TodoRepeatDto {
  return match(repeat)
    .returnType<TodoRepeatDto>()
    .with({ frequency: 'DAILY' }, ({ end }) => ({ frequency: 'DAILY', end: toRepeatEndDto(end) }))
    .with({ frequency: 'WEEKLY' }, ({ interval, weekdays, end }) => ({
      frequency: 'WEEKLY',
      interval,
      weekdays: [...weekdays],
      end: toRepeatEndDto(end),
    }))
    .with({ frequency: 'MONTHLY' }, ({ monthDay, end }) => ({
      frequency: 'MONTHLY',
      monthDay,
      end: toRepeatEndDto(end),
    }))
    .exhaustive();
}

export function toTodoRepeatFormValues(
  startDate: DateKey,
  repeat: TodoRepeat | null,
): TodoRepeatFormValues {
  const startWeekday = [getDateKeyDayOfWeek(startDate)];
  const base = {
    startDate,
    weekdays: startWeekday,
    interval: 1 as const,
    isMonthly: false,
    monthDay: null,
    endType: 'UNTIL' as const,
    untilDate: null,
    count: TODO_REPEAT_DEFAULT_COUNT,
  };

  if (repeat == null) {
    return base;
  }

  const withEnd = {
    ...base,
    endType: repeat.end.type,
    untilDate: repeat.end.type === 'UNTIL' ? repeat.end.date : null,
    count: repeat.end.type === 'COUNT' ? repeat.end.count : base.count,
  };

  return match(repeat)
    .returnType<TodoRepeatFormValues>()
    .with({ frequency: 'DAILY' }, () => ({ ...withEnd, weekdays: [...DAYS_OF_WEEK] }))
    .with({ frequency: 'WEEKLY' }, ({ weekdays, interval }) => ({
      ...withEnd,
      weekdays: [...weekdays],
      interval,
    }))
    .with({ frequency: 'MONTHLY' }, ({ monthDay }) => ({ ...withEnd, isMonthly: true, monthDay }))
    .exhaustive();
}
