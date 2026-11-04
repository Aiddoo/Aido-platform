import { type CreateRecurringTodoInput, DAYS_OF_WEEK } from '@aido/api';
import { addDaysToDateKey } from '@src/shared/utils/date-key';
import { match } from 'ts-pattern';

import { TODO_REPEAT_DEFAULT_UNTIL_DAYS } from '../constants/todo-repeat.constants';
import {
  type TodoEditScope,
  type TodoRepeat,
  TodoRepeatPolicy,
} from '../domains/todo-repeat.model';

export interface RepeatingTodoDraft {
  title: string;
  categoryId: number;
  startDate: string;
  scheduledTime?: string | null;
  isAllDay: boolean;
  visibility: 'PUBLIC' | 'PRIVATE';
  repeat: TodoRepeat;
}

export interface TodoSeriesEditOptions {
  scope: TodoEditScope;
  repeat?: TodoRepeat | null;
}

function getLegacyWeekdays(repeat: TodoRepeat): CreateRecurringTodoInput['daysOfWeek'] | null {
  return match(repeat)
    .returnType<CreateRecurringTodoInput['daysOfWeek'] | null>()
    .with({ frequency: 'DAILY' }, () => [...DAYS_OF_WEEK])
    .with({ frequency: 'WEEKLY', interval: 1 }, ({ weekdays }) => weekdays)
    .with({ frequency: 'WEEKLY', interval: 2 }, () => null)
    .with({ frequency: 'MONTHLY' }, () => null)
    .exhaustive();
}

function getLegacyEndDate(repeat: TodoRepeat, startDate: string): string {
  return match(repeat.end)
    .with({ type: 'UNTIL' }, ({ date }) => date)
    .with({ type: 'NEVER' }, () => addDaysToDateKey(startDate, TODO_REPEAT_DEFAULT_UNTIL_DAYS))
    .with(
      { type: 'COUNT' },
      () => TodoRepeatPolicy.getLastOccurrenceDateKey(repeat, startDate) ?? startDate,
    )
    .exhaustive();
}

export interface LegacyRecurrence {
  daysOfWeek: CreateRecurringTodoInput['daysOfWeek'];
  endDate: string;
}

/**
 * 반복 규칙 서버 계약(7.3)이 들어오면 이 파일의 요청 변환만 새 계약으로 바꾼다.
 * 지금은 기존 매주 + 날짜 종료로 표현할 수 있는 규칙만 만든다.
 */
export function toLegacyRecurrence(repeat: TodoRepeat, startDate: string): LegacyRecurrence | null {
  const daysOfWeek = getLegacyWeekdays(repeat);
  if (daysOfWeek == null) {
    return null;
  }

  return { daysOfWeek, endDate: getLegacyEndDate(repeat, startDate) };
}

export function toLegacyRecurringRequest(
  draft: RepeatingTodoDraft,
): CreateRecurringTodoInput | null {
  const recurrence = toLegacyRecurrence(draft.repeat, draft.startDate);
  if (recurrence == null) {
    return null;
  }

  return {
    title: draft.title,
    categoryId: draft.categoryId,
    startDate: draft.startDate,
    endDate: recurrence.endDate,
    daysOfWeek: recurrence.daysOfWeek,
    scheduledTime: draft.isAllDay ? undefined : draft.scheduledTime,
    isAllDay: draft.isAllDay,
    visibility: draft.visibility,
  };
}

/** 범위(7.5)·규칙 변경이 없는 요청만 기존 PATCH·DELETE로 보낼 수 있다. */
export function isLegacySeriesRequest(scope: TodoEditScope, repeat?: TodoRepeat | null): boolean {
  // nullish-strict: 생략은 규칙 유지, null은 반복 끝내기다
  return scope === 'THIS_ONLY' && repeat === undefined;
}
