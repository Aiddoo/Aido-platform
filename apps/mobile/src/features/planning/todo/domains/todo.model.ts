import { timeOfDaySchema } from '@aido/api/common';
import { TODO_EDIT_SCOPES, TODO_LIMITS } from '@aido/api/vocabulary';
import { todoCategorySchema } from '@src/features/planning/category/domains/todo-category.model';
import { addDaysToDateKey, dateKeySchema, type DateKey } from '@src/shared/date/date-key';
import { instantSchema } from '@src/shared/date/instant';
import { toHHmm } from '@src/shared/date/zoned';
import { isOptimisticId } from '@src/shared/domains/optimistic-id.model';
import { truncateGraphemes } from '@src/shared/domains/text-limit.model';
import { z } from 'zod';

import { type SubTodo, subTodoSchema } from './sub-todo.model';
import { type TodoEditScope, todoRepeatSchema } from './todo-repeat.model';
import {
  createTodoDateSpan,
  findShiftedEndDate,
  hasScheduledTimeChanged,
  type TodoDateSpan,
  todoScheduleSchema,
  type TodoTimeChoice,
} from './todo-schedule.model';
import { isPrivateVisibility, todoVisibilitySchema } from './todo-visibility.model';

export const todoSchema = z.object({
  id: z.int(),
  title: z.string(),
  completed: z.boolean(),
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
  recurrenceGroupId: z.string().nullable(),
  commentCount: z.int().nonnegative(),
  startDate: dateKeySchema,
  endDate: dateKeySchema.nullable(),
  category: todoCategorySchema.pick({ id: true, name: true, color: true }),
  /** 사용자가 고른 벽시계(HH:mm). 어디서든 이 시각이라 표시와 수정 기본값은 이 값만 쓴다. 종일은 null */
  localTime: timeOfDaySchema.nullable(),
  /** 서버가 벽시계 칸을 비워 둔 시간 행의 시각을 표시 때 시간대로 계산하려고 순간을 함께 둔다. 시간 없는 할 일은 null */
  scheduledAt: instantSchema.nullable(),
  /** 단일 할 일이나 규칙이 없는 옛 묶음, 친구 할 일은 null */
  repeat: todoRepeatSchema.nullable(),
  subTodos: z.array(subTodoSchema),
});
export type Todo = z.infer<typeof todoSchema>;

/** 할 일 고치기에서 바꿀 수 있는 칸. 작성·수정 폼 값에서 반복을 뺀 모양이다 */
export const todoEditableFieldsSchema = todoScheduleSchema.omit({ repeat: true }).extend({
  title: todoSchema.shape.title,
  visibility: todoVisibilitySchema,
  categoryId: todoSchema.shape.category.shape.id,
});

/** 고친 칸만 담는다. 없는 칸은 서버가 그대로 두고 null은 비운다 */
export type TodoFieldChanges = Partial<z.infer<typeof todoEditableFieldsSchema>>;

// 메모·캘린더 일정처럼 긴 글에서 제목을 만든다. 서버 제목 한도까지 담고 글자를 반으로 자르지 않는다
export function createTodoTitle(text: string): string {
  return truncateGraphemes(text, TODO_LIMITS.TITLE_MAX_LENGTH);
}

function withSubTodos(todo: Todo, subTodos: SubTodo[]): Todo {
  return { ...todo, subTodos };
}

export const TodoPolicy = {
  findSubTodo(todo: Todo | null, subTodoId: number): SubTodo | null {
    return todo?.subTodos.find((subTodo) => subTodo.id === subTodoId) ?? null;
  },

  // 지우기 전의 항목과 그 자리. 실패하면 그 자리에 되돌린다. 캐시에 없는 할 일(null)과 목록에 없는 항목은 되돌릴 것이 없다
  findSubTodoSnapshot(
    todo: Todo | null,
    subTodoId: number,
  ): { subTodo: SubTodo; index: number } | null {
    if (todo == null) {
      return null;
    }
    const index = todo.subTodos.findIndex((subTodo) => subTodo.id === subTodoId);
    const subTodo = todo.subTodos[index];
    return subTodo == null ? null : { subTodo, index };
  },

  // 묶음 id가 있으면 반복에서 생긴 할 일이다
  isRecurringTodo(todo: Todo): boolean {
    return todo.recurrenceGroupId != null;
  },

  // 규칙 없는 묶음(이관에서 패턴을 잃음)은 서버가 범위 수정·끝내기를 받지 않아 "이 할 일만"으로 다룬다
  hasRepeatRule(todo: Todo): boolean {
    return this.isRecurringTodo(todo) && todo.repeat != null;
  },

  // 규칙 없는 묶음의 회차는 서버가 반복 전환을 받지 않는다(TODO_0845)
  canChangeRepeat(todo: Todo): boolean {
    return !this.isRecurringTodo(todo) || this.hasRepeatRule(todo);
  },

  // 단일 할 일은 묻지 않으므로 비어 있다. 규칙 없는 묶음은 "이후"의 기준이 없다
  getDeleteScopes(todo: Todo): readonly TodoEditScope[] {
    if (!this.isRecurringTodo(todo)) {
      return [];
    }
    return this.hasRepeatRule(todo) ? TODO_EDIT_SCOPES : ['THIS_ONLY', 'ALL'];
  },

  isMultiDayTodo(todo: Todo): boolean {
    return todo.endDate != null && todo.endDate !== todo.startDate;
  },

  isOptimisticTodo(todo: Todo): boolean {
    return isOptimisticId(todo.id);
  },

  isPrivateTodo(todo: Todo): boolean {
    return isPrivateVisibility(todo.visibility);
  },

  getDateSpan(todo: Todo): TodoDateSpan {
    return createTodoDateSpan(todo.startDate, todo.endDate);
  },

  isTodoOnDate(todo: Todo, date: DateKey): boolean {
    const { startDate, endDate } = this.getDateSpan(todo);
    return startDate <= date && date <= endDate;
  },

  findShiftedEndDate(todo: Todo, startDate: DateKey): DateKey | null {
    return findShiftedEndDate(todo.startDate, todo.endDate, startDate);
  },

  // 서버가 준 벽시계는 어디서든 그 시각이고 칸을 비워 둔 시간 행만 순간을 시간대로 읽는다. 종일·시간 없음은 null
  findLocalTime(todo: Todo, timezone: string): string | null {
    if (todo.isAllDay) {
      return null;
    }
    if (todo.localTime != null) {
      return todo.localTime;
    }
    return todo.scheduledAt == null ? null : toHHmm(todo.scheduledAt, timezone);
  },

  // 시간 시트가 고른 값이 지금 시간과 다른가. 같으면 요청을 보내지 않는다
  hasTimeChanged(todo: Todo, picked: TodoTimeChoice, timezone: string): boolean {
    return hasScheduledTimeChanged(picked, {
      isAllDay: todo.isAllDay,
      scheduledTime: this.findLocalTime(todo, timezone),
    });
  },

  // 여러 날 할 일도 시작일로 본다. "오늘 하기·내일 하기"가 이 날을 기준으로 옮긴다
  isTodoStartingOn(todo: Todo, date: DateKey): boolean {
    return todo.startDate === date;
  },

  // 오늘 할 일은 내일로, 다른 날 할 일은 오늘로 옮기고 새 시작일보다 앞선 끝 날짜는 지운다
  getTodayToggleDates(todo: Todo, todayKey: DateKey): Pick<Todo, 'startDate' | 'endDate'> {
    const startDate = this.isTodoStartingOn(todo, todayKey)
      ? addDaysToDateKey(todayKey, 1)
      : todayKey;
    return {
      startDate,
      endDate: todo.endDate != null && todo.endDate < startDate ? null : todo.endDate,
    };
  },

  // 친구 피드 행에는 서버 권한이 없어 버튼만 미리 감춘다. 서버 콕 보내기 규칙(끝내지 않은 오늘 할 일, NUDGE_1106)과 같다
  canNudgeOnDate(todo: Todo, targetDateKey: DateKey, todayKey: DateKey): boolean {
    return !todo.completed && targetDateKey === todayKey;
  },

  withSubTodoCompleted(todo: Todo, subTodoId: number, completed: boolean): Todo {
    return withSubTodos(
      todo,
      todo.subTodos.map((subTodo) =>
        subTodo.id === subTodoId ? { ...subTodo, completed } : subTodo,
      ),
    );
  },

  // 서버와 같은 규칙이다. 끝낸 일에 항목을 더하면 남은 일이 생겨 완료가 풀린다
  withSubTodoAdded(todo: Todo, subTodo: SubTodo): Todo {
    return { ...withSubTodos(todo, [...todo.subTodos, subTodo]), completed: false };
  },

  withSubTodoRemoved(todo: Todo, subTodoId: number): Todo {
    return withSubTodos(
      todo,
      todo.subTodos.filter((subTodo) => subTodo.id !== subTodoId),
    );
  },

  withSubTodoRenamed(todo: Todo, subTodoId: number, title: string): Todo {
    return withSubTodos(
      todo,
      todo.subTodos.map((subTodo) => (subTodo.id === subTodoId ? { ...subTodo, title } : subTodo)),
    );
  },

  withSubTodoRestored(todo: Todo, { subTodo, index }: { subTodo: SubTodo; index: number }): Todo {
    if (todo.subTodos.some(({ id }) => id === subTodo.id)) {
      return todo;
    }
    return withSubTodos(todo, [
      ...todo.subTodos.slice(0, index),
      subTodo,
      ...todo.subTodos.slice(index),
    ]);
  },

  // 받은 순서대로 놓는다. 순서를 정할 때 없던 항목(그 사이 추가)은 뒤에 남긴다
  withSubTodosOrdered(todo: Todo, subTodoIds: readonly number[]): Todo {
    const listed = subTodoIds.flatMap((id) => todo.subTodos.filter((subTodo) => subTodo.id === id));
    const rest = todo.subTodos.filter((subTodo) => !subTodoIds.includes(subTodo.id));
    return withSubTodos(todo, [...listed, ...rest]);
  },

  // 임시 항목을 응답에 새로 생긴 같은 제목의 항목으로 바꾼다. 다른 항목의 진행 중인 변경은 지킨다
  withSubTodoConfirmed(
    todo: Todo,
    optimisticId: number,
    saved: { subTodos: readonly SubTodo[] },
  ): Todo {
    const optimistic = todo.subTodos.find((subTodo) => subTodo.id === optimisticId);
    const confirmed = saved.subTodos.find(
      (subTodo) =>
        subTodo.title === optimistic?.title && !todo.subTodos.some(({ id }) => id === subTodo.id),
    );
    if (confirmed == null) {
      return todo;
    }
    return withSubTodos(
      todo,
      todo.subTodos.map((subTodo) => (subTodo.id === optimisticId ? confirmed : subTodo)),
    );
  },
};
