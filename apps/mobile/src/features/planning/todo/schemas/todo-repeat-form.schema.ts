import { DAYS_OF_WEEK, TODO_REPEAT_END_TYPES } from '@aido/api/vocabulary';
import { getDayOfMonth } from '@src/shared/date/date-key';
import { sortDaysOfWeek } from '@src/shared/date/day-of-week';
import { instantFieldSchema } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';
import { TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { type TodoRepeat, type TodoRepeatEnd } from '../domains/todo-repeat.model';

const todoRepeatFormShape = z.object({
  startDate: instantFieldSchema,
  weekdays: z.array(z.enum(DAYS_OF_WEEK)),
  interval: z.union([z.literal(1), z.literal(2)]),
  isMonthly: z.boolean(),
  /** 규칙이 가진 매월 며칠. 시작일을 옮기기 전까지 유지해 2월 28일 회차에서 열어도 31일 규칙이 그대로다. 없으면 시작일을 따른다 */
  monthDay: z.int().min(1).max(31).nullable(),
  endType: z.enum(TODO_REPEAT_END_TYPES),
  untilDate: instantFieldSchema.nullable(),
  count: z.int().min(TODO_REPEAT_COUNT.MIN).max(TODO_REPEAT_COUNT.MAX),
});

export type TodoRepeatFormValues = z.input<typeof todoRepeatFormShape>;

export function getTodoRepeatFormMonthDay(
  { monthDay, startDate }: Pick<TodoRepeatFormValues, 'monthDay' | 'startDate'>,
  timeZone: string,
): number {
  return monthDay ?? getDayOfMonth(toDateKey(startDate, timeZone));
}

function toTodoRepeatEnd(values: TodoRepeatFormValues, timeZone: string): TodoRepeatEnd | null {
  return match(values.endType)
    .returnType<TodoRepeatEnd | null>()
    .with('NEVER', () => ({ type: 'NEVER' }))
    .with('UNTIL', () =>
      values.untilDate == null
        ? null
        : { type: 'UNTIL', date: toDateKey(values.untilDate, timeZone) },
    )
    .with('COUNT', () => ({ type: 'COUNT', count: values.count }))
    .exhaustive();
}

export function toTodoRepeat(values: TodoRepeatFormValues, timeZone: string): TodoRepeat | null {
  const end = toTodoRepeatEnd(values, timeZone);
  if (end == null) {
    return null;
  }

  if (values.isMonthly) {
    return {
      frequency: 'MONTHLY',
      monthDay: getTodoRepeatFormMonthDay(values, timeZone),
      end,
    };
  }

  if (values.weekdays.length === 0) {
    return null;
  }

  if (values.interval === 1 && values.weekdays.length === DAYS_OF_WEEK.length) {
    return { frequency: 'DAILY', end };
  }

  return {
    frequency: 'WEEKLY',
    interval: values.interval,
    weekdays: sortDaysOfWeek(values.weekdays),
    end,
  };
}

export type TodoRepeatFormIssue = 'no-weekdays' | 'until-required' | 'no-occurrence';

export function getTodoRepeatFormIssue(
  values: TodoRepeatFormValues,
  timeZone: string,
): TodoRepeatFormIssue | null {
  if (!values.isMonthly && values.weekdays.length === 0) {
    return 'no-weekdays';
  }
  const repeat = toTodoRepeat(values, timeZone);
  if (repeat == null) {
    return 'until-required';
  }
  return TodoRepeatPolicy.findFirstRepeatOccurrenceDateKey(
    repeat,
    toDateKey(values.startDate, timeZone),
  ) == null
    ? 'no-occurrence'
    : null;
}

const ISSUE_PATH = {
  'no-weekdays': 'weekdays',
  'until-required': 'untilDate',
  'no-occurrence': 'untilDate',
} as const satisfies Record<TodoRepeatFormIssue, keyof TodoRepeatFormValues>;

export function createTodoRepeatFormSchema(timeZone: string) {
  return todoRepeatFormShape.check(({ value, issues }) => {
    const issue = getTodoRepeatFormIssue(value, timeZone);
    if (issue != null) {
      issues.push({ code: 'custom', input: value, message: issue, path: [ISSUE_PATH[issue]] });
    }
  });
}
