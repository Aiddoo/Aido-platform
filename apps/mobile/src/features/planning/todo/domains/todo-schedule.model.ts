import { timeOfDaySchema } from '@aido/api/common';
import {
  addDaysToDateKey,
  type DateKey,
  dateKeySchema,
  diffDateKeysInDays,
} from '@src/shared/date/date-key';
import { z } from 'zod';

import { type TodoRepeat, TodoRepeatPolicy, todoRepeatSchema } from './todo-repeat.model';

// 작성·수정 폼과 음성 계획 카드가 고르는 일정. 날짜는 앱 시간대의 날짜 key, 시각은 벽시계(HH:mm)다
export const todoScheduleSchema = z.object({
  startDate: dateKeySchema,
  endDate: dateKeySchema.nullable(),
  scheduledTime: timeOfDaySchema.nullable(),
  isAllDay: z.boolean(),
  repeat: todoRepeatSchema.nullable(),
});
export type TodoSchedule = z.infer<typeof todoScheduleSchema>;

/** 할 일이 걸친 날짜. 여러 날 할 일만 시작일과 끝날이 다르다 */
export interface TodoDateSpan {
  startDate: DateKey;
  endDate: DateKey;
}

/** 시간 고르기가 주는 값. 종일이면 시각이 남아 있어도 쓰지 않는다 */
export interface TodoTimeChoice {
  isAllDay: boolean;
  scheduledTime: string | null;
}

// 하루짜리는 끝날이 비어 있다
export function createTodoDateSpan(startDate: DateKey, endDate: DateKey | null): TodoDateSpan {
  return { startDate, endDate: endDate ?? startDate };
}

// 시작일을 옮겨도 여러 날 기간은 길이를 지킨다. 하루짜리는 끝날이 없다
export function findShiftedEndDate(
  startDate: DateKey,
  endDate: DateKey | null,
  nextStartDate: DateKey,
): DateKey | null {
  return endDate == null
    ? null
    : addDaysToDateKey(nextStartDate, diffDateKeysInDays(startDate, endDate));
}

// 종일이면 남아 있는 시각을 버린다. 시각과 종일을 따로 가진 폼·시트·AI 응답이 쓸 시각이다
export function findScheduledTime(isAllDay: boolean, scheduledTime: string | null): string | null {
  return isAllDay ? null : scheduledTime;
}

// 반복과 여러 날 기간은 함께 두지 않는다. 반복이면 끝 날짜를 지운다
export function findPeriodEndDate(endDate: DateKey | null, isRepeating: boolean): DateKey | null {
  return isRepeating ? null : endDate;
}

// 종일끼리는 남은 시각 값이 달라도 바뀐 것이 아니다
export function hasScheduledTimeChanged(next: TodoTimeChoice, previous: TodoTimeChoice): boolean {
  return (
    next.isAllDay !== previous.isAllDay ||
    findScheduledTime(next.isAllDay, next.scheduledTime) !==
      findScheduledTime(previous.isAllDay, previous.scheduledTime)
  );
}

export const TodoSchedulePolicy = {
  findScheduledTime(schedule: TodoSchedule): string | null {
    return findScheduledTime(schedule.isAllDay, schedule.scheduledTime);
  },

  hasTimeChanged(schedule: TodoSchedule, previous: TodoSchedule): boolean {
    return hasScheduledTimeChanged(schedule, previous);
  },

  getDateSpan(schedule: TodoSchedule): TodoDateSpan {
    return createTodoDateSpan(schedule.startDate, schedule.endDate);
  },

  // 반복은 시작일을 따라온다. 반복 회차의 날짜 이동은 그 회차에만 적용돼 규칙을 그대로 둔다
  withStartDate(
    schedule: TodoSchedule,
    startDate: DateKey,
    { isSeriesOccurrence }: { isSeriesOccurrence: boolean },
  ): TodoSchedule {
    const repeat =
      schedule.repeat != null && !isSeriesOccurrence
        ? TodoRepeatPolicy.withRepeatStartDate(schedule.repeat, schedule.startDate, startDate)
        : schedule.repeat;
    return {
      ...schedule,
      startDate,
      endDate: findShiftedEndDate(schedule.startDate, schedule.endDate, startDate),
      repeat,
    };
  },

  withRepeat(
    schedule: TodoSchedule,
    { startDate, repeat }: { startDate: DateKey; repeat: TodoRepeat | null },
  ): TodoSchedule {
    return {
      ...schedule,
      startDate,
      repeat,
      endDate: findPeriodEndDate(schedule.endDate, repeat != null),
    };
  },
};
