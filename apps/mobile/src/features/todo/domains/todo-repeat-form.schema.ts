import { DAYS_OF_WEEK, TODO_REPEAT_END_TYPES, type DayOfWeek } from '@aido/api/vocabulary';
import { toDeviceDateKey } from '@src/shared/utils/date-key';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { TODO_REPEAT_COUNT } from '../constants/todo-repeat.constants';
import {
  getMonthDayOfDateKey,
  type TodoRepeat,
  type TodoRepeatEnd,
  TodoRepeatPolicy,
} from './todo-repeat.model';

const todoRepeatFormShape = z.object({
  startDate: z.date(),
  weekdays: z.array(z.enum(DAYS_OF_WEEK)),
  interval: z.union([z.literal(1), z.literal(2)]),
  isMonthly: z.boolean(),
  endType: z.enum(TODO_REPEAT_END_TYPES),
  untilDate: z.date().nullable(),
  count: z.int().min(TODO_REPEAT_COUNT.MIN).max(TODO_REPEAT_COUNT.MAX),
});

export type TodoRepeatFormValues = z.input<typeof todoRepeatFormShape>;

const WEEK_LENGTH = 7;

function sortWeekdays(weekdays: readonly DayOfWeek[]): DayOfWeek[] {
  return DAYS_OF_WEEK.filter((day) => weekdays.includes(day));
}

function toTodoRepeatEnd(values: TodoRepeatFormValues): TodoRepeatEnd | null {
  return match(values.endType)
    .returnType<TodoRepeatEnd | null>()
    .with('NEVER', () => ({ type: 'NEVER' }))
    .with('UNTIL', () =>
      values.untilDate == null ? null : { type: 'UNTIL', date: toDeviceDateKey(values.untilDate) },
    )
    .with('COUNT', () => ({ type: 'COUNT', count: values.count }))
    .exhaustive();
}

/** 요일이 없거나 날짜 종료인데 종료일이 없으면 반복을 만들 수 없다. */
export function toTodoRepeat(values: TodoRepeatFormValues): TodoRepeat | null {
  const end = toTodoRepeatEnd(values);
  if (end == null) {
    return null;
  }

  if (values.isMonthly) {
    return {
      frequency: 'MONTHLY',
      monthDay: getMonthDayOfDateKey(toDeviceDateKey(values.startDate)),
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

/** 반복을 확인할 수 없는 이유 하나. 확인 버튼(스키마)과 요약 문구가 같은 판단을 쓴다 */
export function getTodoRepeatFormIssue(values: TodoRepeatFormValues): TodoRepeatFormIssue | null {
  if (!values.isMonthly && values.weekdays.length === 0) {
    return 'no-weekdays';
  }
  const repeat = toTodoRepeat(values);
  if (repeat == null) {
    return 'until-required';
  }
  return TodoRepeatPolicy.getFirstOccurrenceDateKey(repeat, toDeviceDateKey(values.startDate)) ==
    null
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
