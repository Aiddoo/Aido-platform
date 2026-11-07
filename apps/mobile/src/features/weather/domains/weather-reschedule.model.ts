import { type Instant, toHHmm } from '@src/shared/date/instant';

export interface ScheduleChange {
  todoId: number;
  startsAt: Instant;
}

export interface TodoScheduleSnapshot {
  startDate: string;
  endDate: string | null;
  localTime: string | null;
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
function getMovedScheduleInput(
  todo: Pick<TodoScheduleSnapshot, 'startDate' | 'endDate'>,
  startsAt: Instant,
  timeZone: string,
): TodoScheduleInput {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: toHHmm(startsAt, timeZone),
    isAllDay: false,
  };
}

/** 되돌리기: 옮기기 전 날짜·시각·종일 여부를 그대로 다시 저장한다. */
function getOriginalScheduleInput(todo: TodoScheduleSnapshot): TodoScheduleInput {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: todo.isAllDay ? null : todo.localTime,
    isAllDay: todo.isAllDay,
  };
}

export interface RescheduleTarget<TTodo> {
  todo: TTodo;
  startsAt: Instant;
}

/**
 * 실제로 옮길 할 일과 시각. 시트를 연 사이 지워졌거나 완료된 할 일(다른 기기·알림 동작·날짜가 바뀐 목록)은 옮기지 않는다.
 * 비어 있으면 옮길 것이 없으므로 주 버튼을 끈다.
 */
function getRescheduleTargets<TTodo extends { id: number; completed: boolean }>(
  changes: readonly ScheduleChange[],
  todos: readonly TTodo[],
): RescheduleTarget<TTodo>[] {
  const todosById = new Map(todos.map((todo) => [todo.id, todo]));
  return changes.flatMap(({ todoId, startsAt }) => {
    const todo = todosById.get(todoId);
    return todo == null || todo.completed ? [] : [{ todo, startsAt }];
  });
}

export const WeatherReschedulePolicy = {
  getMovedScheduleInput,
  getOriginalScheduleInput,
  getRescheduleTargets,
} as const;
