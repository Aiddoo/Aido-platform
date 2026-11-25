import { toInstant } from '@src/shared/date/instant';
import { z } from 'zod';

import type { ScheduleChange } from '../domains/weather-reschedule.model';

export const weatherRescheduleFormSchema = z.object({
  /** 선택 키(`toSelectionKey`) → 옮길 시작 시각(ISO). 옮기지 않을 할 일은 목록에서 빼므로 값이 없다. */
  selections: z.record(z.string(), z.iso.datetime()),
});

export type WeatherRescheduleFormValues = z.infer<typeof weatherRescheduleFormSchema>;

/** react-hook-form은 숫자 경로를 배열 index로 읽어 selections를 배열로 만들므로 숫자만으로 된 키를 쓰지 않는다 */
export function toSelectionKey(todoId: number): string {
  return `todo-${todoId}`;
}

/** 시트에 남아 있는 할 일만 옮긴다. 목록에서 뺀 할 일의 이전 선택은 무시한다. */
export function toScheduleChanges(
  { selections }: WeatherRescheduleFormValues,
  todoIds: readonly number[],
): ScheduleChange[] {
  return todoIds.flatMap((todoId) => {
    const selection = selections[toSelectionKey(todoId)];
    return selection == null ? [] : [{ todoId, startsAt: toInstant(selection) }];
  });
}
