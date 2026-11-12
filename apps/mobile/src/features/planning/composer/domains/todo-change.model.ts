import {
  type TodoRepeat,
  TodoRepeatPolicy,
} from '@src/features/planning/todo/domains/todo-repeat.model';
import {
  getScheduledTime,
  hasScheduleChanged,
  type TodoEditableFields,
  type TodoFieldChanges,
} from '@src/features/planning/todo/domains/todo.model';

export interface TodoUpdateChanges {
  fields: TodoFieldChanges;
  /** 생략은 규칙 유지, null은 반복 끝내기 */
  repeat?: TodoRepeat | null;
}

type TodoEditValues = TodoEditableFields & { repeat: TodoRepeat | null };

/** 수정 폼에서 바뀐 칸만 고른다. 종일로 바꾸면 시각은 비운다 */
export function getTodoUpdateChanges(
  edited: TodoEditValues,
  saved: TodoEditValues,
): TodoUpdateChanges {
  const scheduledTime = getScheduledTime(edited);
  const isScheduleChanged = hasScheduleChanged(
    { isAllDay: edited.isAllDay, scheduledTime },
    { isAllDay: saved.isAllDay, scheduledTime: getScheduledTime(saved) },
  );

  return {
    fields: {
      ...(edited.title !== saved.title && { title: edited.title }),
      ...(edited.categoryId !== saved.categoryId && { categoryId: edited.categoryId }),
      ...(edited.startDate !== saved.startDate && { startDate: edited.startDate }),
      ...(edited.endDate !== saved.endDate && { endDate: edited.endDate }),
      ...(isScheduleChanged && { scheduledTime, isAllDay: edited.isAllDay }),
      ...(edited.visibility !== saved.visibility && { visibility: edited.visibility }),
    },
    ...(!TodoRepeatPolicy.hasSameRepeat(edited.repeat, saved.repeat) && {
      repeat: edited.repeat,
    }),
  };
}

export function hasTodoUpdateChanges({ fields, repeat }: TodoUpdateChanges): boolean {
  // oxlint-disable-next-line aido/no-strict-nullish -- repeat null은 반복 끝내기라 변경이다
  return Object.keys(fields).length > 0 || repeat !== undefined;
}

// 날짜 이동은 범위와 상관없이 이 회차에만 적용되므로 범위를 묻지 않는다
export function hasOnlyDateChanges({ fields, repeat }: TodoUpdateChanges): boolean {
  // oxlint-disable-next-line aido/no-strict-nullish -- repeat null도 날짜 밖의 변경이다
  if (repeat !== undefined) {
    return false;
  }
  const changed = Object.keys(fields);
  return (
    changed.length > 0 && changed.every((field) => field === 'startDate' || field === 'endDate')
  );
}

export const TodoChangePolicy = { hasTodoUpdateChanges, hasOnlyDateChanges } as const;
