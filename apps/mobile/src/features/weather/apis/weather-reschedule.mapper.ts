import { type Todo, TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { DateKey } from '@src/shared/date/date-key';
import { type Instant, toInstant } from '@src/shared/date/instant';
import { toHHmm } from '@src/shared/date/zoned';

import type { ScheduleChange } from '../domains/weather-reschedule.model';
import {
  toSelectionKey,
  type WeatherRescheduleFormValues,
} from '../schemas/weather-reschedule-form.schema';

interface TodoScheduleRequest {
  startDate: DateKey;
  endDate: DateKey | null;
  scheduledTime: string | null;
  isAllDay: boolean;
}

/** 목록에서 뺀 할 일은 칸이 내려가며 선택이 지워져(shouldUnregister) 여기서 걸러지지 않아도 실리지 않는다 */
export function toScheduleChanges(
  { selections }: WeatherRescheduleFormValues,
  todoIds: readonly number[],
): ScheduleChange[] {
  return todoIds.flatMap((todoId) => {
    const selection = selections[toSelectionKey(todoId)];
    return selection == null ? [] : [{ todoId, startsAt: toInstant(selection) }];
  });
}

/** 일괄 변경 결과. 성공한 할 일만 모으고, 실패는 이유만 모아 한 번에 알린다. */
export function toRescheduleOutcome<TTodo>(
  targets: readonly { todo: TTodo }[],
  results: readonly PromiseSettledResult<unknown>[],
): { moved: TTodo[]; failures: unknown[] } {
  return {
    moved: targets.flatMap(({ todo }, index) =>
      results[index]?.status === 'fulfilled' ? [todo] : [],
    ),
    failures: results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : [])),
  };
}

/** 후보 시각은 할 일과 같은 날(기기 시간대)이라 날짜는 두고 시각(기기 시간대 HH:mm)만 바꾼다 */
export function toMovedScheduleRequest(
  todo: Pick<Todo, 'startDate' | 'endDate'>,
  startsAt: Instant,
  timezone: string,
): TodoScheduleRequest {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: toHHmm(startsAt, timezone),
    isAllDay: false,
  };
}

/** 시각은 날씨 목록이 보인 것과 같게 읽어(`toWeatherBriefingTodo`) 서버가 벽시계를 비운 할 일도 기기 시각으로 되돌린다 */
export function toOriginalScheduleRequest(todo: Todo, timezone: string): TodoScheduleRequest {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: TodoPolicy.findLocalTime(todo, timezone),
    isAllDay: todo.isAllDay,
  };
}
