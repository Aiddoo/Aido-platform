import { findScheduledTime } from '@src/features/planning/todo/domains/todo-schedule.model';
import type { DateKey } from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';
import { toHHmm } from '@src/shared/date/zoned';

/** 할 일에서 일정 요청이 읽는 칸. 옮기기 전 값을 되돌리기에 그대로 쓴다 */
interface TodoScheduleSnapshot {
  startDate: DateKey;
  endDate: DateKey | null;
  localTime: string | null;
  isAllDay: boolean;
}

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
  todo: TodoScheduleSnapshot,
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

/** 되돌리기: 옮기기 전 날짜·시각·종일 여부를 그대로 다시 저장한다. */
export function toOriginalScheduleRequest(todo: TodoScheduleSnapshot): TodoScheduleRequest {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: findScheduledTime(todo.isAllDay, todo.localTime),
    isAllDay: todo.isAllDay,
  };
}
