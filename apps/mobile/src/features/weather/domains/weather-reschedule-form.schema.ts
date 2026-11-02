import { toHHmm } from '@src/shared/utils/time';
import { z } from 'zod';

export const weatherRescheduleFormSchema = z.object({
  /** 선택 키(`toSelectionKey`) → 옮길 시작 시각(ISO). 옮기지 않을 할 일은 목록에서 빼므로 값이 없다. */
  selections: z.record(z.string(), z.iso.datetime()),
});

/**
 * 폼 필드 이름(`selections.<키>`)에 쓰는 할 일 키.
 * react-hook-form은 숫자 경로를 배열 index로 읽어 selections를 배열로 만들므로 숫자만으로 된 키를 쓰지 않는다.
 */
export function toSelectionKey(todoId: number): string {
  return `todo-${todoId}`;
}

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
    const selection = selections[toSelectionKey(todoId)];
    return selection == null ? [] : [{ todoId, startsAt: new Date(selection) }];
  });
}

export interface RescheduleTarget<TTodo> {
  todo: TTodo;
  startsAt: Date;
}

/**
 * 실제로 옮길 할 일과 시각. 시트를 연 사이 지워졌거나 완료된 할 일(다른 기기·알림 동작·날짜가 바뀐 목록)은 옮기지 않는다.
 * 비어 있으면 옮길 것이 없으므로 주 버튼을 끈다.
 */
export function toRescheduleTargets<TTodo extends { id: number; completed: boolean }>(
  values: WeatherRescheduleFormValues,
  todoIds: readonly number[],
  todos: readonly TTodo[],
): RescheduleTarget<TTodo>[] {
  const todosById = new Map(todos.map((todo) => [todo.id, todo]));
  return toScheduleChanges(values, todoIds).flatMap(({ todoId, startsAt }) => {
    const todo = todosById.get(todoId);
    return todo == null || todo.completed ? [] : [{ todo, startsAt }];
  });
}
