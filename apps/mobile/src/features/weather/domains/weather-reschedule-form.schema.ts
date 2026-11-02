import { toHHmm } from '@src/shared/utils/time';
import { z } from 'zod';

export const weatherRescheduleFormSchema = z.object({
  /** 할 일 id(문자열) → 옮길 시작 시각(ISO). 옮기지 않을 할 일은 목록에서 빼므로 값이 없다. */
  selections: z.record(z.string(), z.iso.datetime()),
});

export type WeatherRescheduleFormValues = z.infer<typeof weatherRescheduleFormSchema>;

export interface ScheduleChange {
  todoId: number;
  startsAt: Date;
}

export interface TodoScheduleSnapshot {
  startDate: string;
  endDate: string | null;
  scheduledAtMs: number | null;
  isAllDay: boolean;
}

export interface TodoScheduleInput {
  startDate: string;
  endDate: string | null;
  scheduledTime: string | null;
  isAllDay: boolean;
}

/**
 * 후보 시각은 할 일과 같은 날(기기 시간대)이라 날짜는 그대로 두고 시각만 바꾼다.
 * 할 일 시각은 기기 시간대의 HH:mm으로 저장한다.
 */
export function toMovedScheduleInput(
  todo: Pick<TodoScheduleSnapshot, 'startDate' | 'endDate'>,
  startsAt: Date,
): TodoScheduleInput {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: toHHmm(startsAt),
    isAllDay: false,
  };
}

/** 되돌리기: 옮기기 전 날짜·시각·종일 여부를 그대로 다시 저장한다. */
export function toOriginalScheduleInput(todo: TodoScheduleSnapshot): TodoScheduleInput {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime:
      todo.isAllDay || todo.scheduledAtMs == null ? null : toHHmm(new Date(todo.scheduledAtMs)),
    isAllDay: todo.isAllDay,
  };
}

/** 시트에 남아 있는 할 일만 옮긴다. 목록에서 뺀 할 일의 이전 선택은 무시한다. */
export function toScheduleChanges(
  { selections }: WeatherRescheduleFormValues,
  todoIds: readonly number[],
): ScheduleChange[] {
  return todoIds.flatMap((todoId) => {
    const selection = selections[String(todoId)];
    return selection == null ? [] : [{ todoId, startsAt: new Date(selection) }];
  });
}
