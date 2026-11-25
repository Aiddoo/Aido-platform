import { type Todo, TodoPolicy } from '@src/features/planning/todo/domains/todo.model';
import type { DateKey } from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';
import { toHHmm } from '@src/shared/date/zoned';

interface TodoScheduleRequest {
  startDate: DateKey;
  endDate: DateKey | null;
  scheduledTime: string | null;
  isAllDay: boolean;
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

/**
 * 되돌리기: 옮기기 전 날짜·시각·종일 여부를 그대로 다시 저장한다. 시각은 날씨 목록이 보인 것과 같게 읽어
 * (`toWeatherBriefingTodo`), 서버가 벽시계를 비운 할 일도 그 순간의 기기 시각으로 되돌린다
 */
export function toOriginalScheduleRequest(todo: Todo, timezone: string): TodoScheduleRequest {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: TodoPolicy.findLocalTime(todo, timezone),
    isAllDay: todo.isAllDay,
  };
}
