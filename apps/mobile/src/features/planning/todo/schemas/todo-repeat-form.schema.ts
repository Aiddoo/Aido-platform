import {
  DAYS_OF_WEEK,
  TODO_REPEAT_END_TYPES,
  TODO_REPEAT_INTERVALS,
  TODO_REPEAT_MONTH_DAY_MAX,
} from '@aido/api/vocabulary';
import { dateKeyFieldSchema, getDayOfMonth } from '@src/shared/date/date-key';
import { sortDaysOfWeek } from '@src/shared/date/day-of-week';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { TodoRepeatPolicy, todoRepeatCountSchema } from '../domains/todo-repeat.model';
import { type TodoRepeat, type TodoRepeatEnd } from '../domains/todo-repeat.model';

const todoRepeatFormShape = z.object({
  startDate: dateKeyFieldSchema,
  weekdays: z.array(z.enum(DAYS_OF_WEEK)),
  interval: z.literal(TODO_REPEAT_INTERVALS),
  isMonthly: z.boolean(),
  /** 규칙이 가진 매월 며칠. 시작일을 옮기기 전까지 유지해 2월 28일 회차에서 열어도 31일 규칙이 그대로다. 없으면 시작일을 따른다 */
  monthDay: z.int().min(1).max(TODO_REPEAT_MONTH_DAY_MAX).nullable(),
  endType: z.enum(TODO_REPEAT_END_TYPES),
  untilDate: dateKeyFieldSchema.nullable(),
  count: todoRepeatCountSchema,
});

export type TodoRepeatFormValues = z.input<typeof todoRepeatFormShape>;

export function getTodoRepeatFormMonthDay({
  monthDay,
  startDate,
}: Pick<TodoRepeatFormValues, 'monthDay' | 'startDate'>): number {
  return monthDay ?? getDayOfMonth(startDate);
}

function toTodoRepeatEnd(values: TodoRepeatFormValues): TodoRepeatEnd | null {
  return match(values.endType)
    .returnType<TodoRepeatEnd | null>()
    .with('NEVER', () => ({ type: 'NEVER' }))
    .with('UNTIL', () =>
      values.untilDate == null ? null : { type: 'UNTIL', date: values.untilDate },
    )
    .with('COUNT', () => ({ type: 'COUNT', count: values.count }))
    .exhaustive();
}

export function toTodoRepeat(values: TodoRepeatFormValues): TodoRepeat | null {
  const end = toTodoRepeatEnd(values);
  if (end == null) {
    return null;
  }

  if (values.isMonthly) {
    return {
      frequency: 'MONTHLY',
      monthDay: getTodoRepeatFormMonthDay(values),
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

export function getTodoRepeatFormIssue(values: TodoRepeatFormValues): TodoRepeatFormIssue | null {
  if (!values.isMonthly && values.weekdays.length === 0) {
    return 'no-weekdays';
  }
  const repeat = toTodoRepeat(values);
  if (repeat == null) {
    return 'until-required';
  }
  return TodoRepeatPolicy.findFirstRepeatOccurrenceDateKey(repeat, values.startDate) == null
    ? 'no-occurrence'
    : null;
}

const ISSUE_PATH = {
  'no-weekdays': 'weekdays',
  'until-required': 'untilDate',
  'no-occurrence': 'untilDate',
} as const satisfies Record<TodoRepeatFormIssue, keyof TodoRepeatFormValues>;

export const todoRepeatFormSchema = todoRepeatFormShape.check(({ value, issues }) => {
  const issue = getTodoRepeatFormIssue(value);
  if (issue != null) {
    issues.push({ code: 'custom', input: value, message: issue, path: [ISSUE_PATH[issue]] });
  }
});
