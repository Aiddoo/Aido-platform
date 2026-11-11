import type { TodoRepeat as TodoRepeatDto, TodoRepeatEnd as TodoRepeatEndDto } from '@aido/api';
import { dateKeySchema } from '@src/shared/date/date-key';
import { match } from 'ts-pattern';

import type { TodoRepeat, TodoRepeatEnd } from '../domains/todo-repeat.model';

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
