import { DAYS_OF_WEEK, TODO_REPEAT_END_TYPES, type DayOfWeek } from '@aido/api/vocabulary';
import { getDayOfMonth } from '@src/shared/date/date-key';
import { toDateKey } from '@src/shared/date/instant';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';
import { TodoRepeatPolicy } from '../domains/todo-repeat.model';
import { type TodoRepeat, type TodoRepeatEnd } from '../schemas/todo-repeat.schema';

const todoRepeatFormShape = z.object({
  startDate: z.date(),
  weekdays: z.array(z.enum(DAYS_OF_WEEK)),
  interval: z.union([z.literal(1), z.literal(2)]),
  isMonthly: z.boolean(),
  /** 규칙이 가진 매월 며칠. 시작일을 옮기기 전까지 유지해 2월 28일 회차에서 열어도 31일 규칙이 그대로다. 없으면 시작일을 따른다 */
  monthDay: z.int().min(1).max(31).nullable(),
  endType: z.enum(TODO_REPEAT_END_TYPES),
  untilDate: z.date().nullable(),
  count: z.int().min(TODO_REPEAT_COUNT.MIN).max(TODO_REPEAT_COUNT.MAX),
});

export type TodoRepeatFormValues = z.input<typeof todoRepeatFormShape>;

const WEEK_LENGTH = 7;

export function getTodoRepeatFormMonthDay({
  monthDay,
  startDate,
}: Pick<TodoRepeatFormValues, 'monthDay' | 'startDate'>): number {
  return monthDay ?? getDayOfMonth(toDateKey(startDate, getDeviceTimezone()));
}

function sortWeekdays(weekdays: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => weekdays.includes(day));
}

function toTodoRepeatEnd(values: TodoRepeatFormValues): TodoRepeatEnd | null {
  return match(values.endType)
    .returnType<TodoRepeatEnd | null>()
    .with('NEVER', () => ({ type: 'NEVER' }))
    .with('UNTIL', () =>
      values.untilDate == null
        ? null
        : { type: 'UNTIL', date: toDateKey(values.untilDate, getDeviceTimezone()) },
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

  if (values.interval === 1 && values.weekdays.length === WEEK_LENGTH) {
    return { frequency: 'DAILY', end };
  }

  return {
    frequency: 'WEEKLY',
    interval: values.interval,
    weekdays: sortWeekdays(values.weekdays),
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
  return TodoRepeatPolicy.getFirstRepeatOccurrenceDateKey(
    repeat,
    toDateKey(values.startDate, getDeviceTimezone()),
  ) == null
    ? 'no-occurrence'
    : null;
}

const ISSUE_PATH = {
  'no-weekdays': 'weekdays',
  'until-required': 'untilDate',
  'no-occurrence': 'untilDate',
} as const satisfies Record<TodoRepeatFormIssue, keyof TodoRepeatFormValues>;

export const todoRepeatFormSchema = todoRepeatFormShape.superRefine((values, context) => {
  const issue = getTodoRepeatFormIssue(values);
  if (issue != null) {
    context.addIssue({ code: 'custom', message: issue, path: [ISSUE_PATH[issue]] });
  }
});
