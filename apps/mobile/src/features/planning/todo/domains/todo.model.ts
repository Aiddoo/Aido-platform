import { TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { todoCategorySchema } from '@src/features/planning/category/domains/todo-category.model';
import { addDaysToDateKey, diffDateKeysInDays } from '@src/shared/date/date-key';
import { instantSchema, toHHmm } from '@src/shared/date/instant';
import { entityIdSchema } from '@src/shared/domains/entity-id.model';
import { z } from 'zod';

import { type SubTodo, subTodoSchema } from './sub-todo.model';
import { todoRepeatSchema } from './todo-repeat.model';

export const todoSchema = z.object({
  id: z.int(),
  title: z.string(),
  completed: z.boolean(),
  isAllDay: z.boolean(),
  visibility: z.enum(TODO_VISIBILITIES),
  recurrenceGroupId: z.string().nullable(),
  commentCount: z.int().nonnegative(),
  startDate: z.iso.date(),
  endDate: z.iso.date().nullable(),
  category: todoCategorySchema.pick({ id: true, name: true, color: true }),
  /** 사용자가 고른 벽시계(HH:mm). 어디서든 이 시각이라 표시와 수정 기본값은 이 값만 쓴다. 종일은 null */
  localTime: z.iso.time({ precision: -1 }).nullable(),
  /** 서버가 벽시계 칸을 비워 둔 시간 행의 시각을 표시 때 시간대로 계산하려고 순간을 함께 둔다. 시간 없는 할 일은 null */
  scheduledAt: instantSchema.nullable(),
  /** 단일 할 일이나 규칙이 없는 옛 묶음, 친구 할 일은 null */
  repeat: todoRepeatSchema.nullable(),
  subTodos: z.array(subTodoSchema),
});
export type Todo = z.infer<typeof todoSchema>;

const optimisticTodoSchema = todoSchema.extend({ optimistic: z.literal(true).readonly() });
export type OptimisticTodo = z.infer<typeof optimisticTodoSchema>;

export const todoListResultSchema = z.object({
  todos: z.array(todoSchema),
  hasNext: z.boolean(),
  nextCursor: z.int().nullable(),
});
export type TodoListResult = z.infer<typeof todoListResultSchema>;

// 기기와 무관한 서버 기록이다
const todoExistenceSchema = z.object({
  hasTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
});
export type TodoExistence = z.infer<typeof todoExistenceSchema>;

export const todoSummarySchema = z.object({
  date: z.string(),
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  completionRate: z.number().min(0).max(100),
  isComplete: z.boolean(),
  currentStreak: z.int().min(0),
  topTodos: z
    .array(
      z.object({
        id: z.int(),
        title: z.string(),
        completed: z.boolean(),
        categoryColor: z.string(),
      }),
    )
    .max(10),
});
export type TodoSummary = z.infer<typeof todoSummarySchema>;

export const todoDetailsSchema = z.object({
  todo: todoSchema,
  owner: z.object({
    id: entityIdSchema,
    name: z.string().nullable(),
    profileImage: z.string().nullable(),
  }),
  permissions: z.object({
    canEdit: z.boolean(),
    canComment: z.boolean(),
    canNudge: z.boolean(),
  }),
  metrics: z.object({
    viewCount: z.int().nonnegative(),
    commentCount: z.int().nonnegative(),
  }),
});
export type TodoDetails = z.infer<typeof todoDetailsSchema>;

// 정하지 않은(null, 생략) 공개 범위는 서버 기본값인 공개로 본다
export function getVisibility(todo: {
  visibility?: Todo['visibility'] | null;
}): Todo['visibility'] {
  return todo.visibility ?? 'PUBLIC';
}

// 비공개 할 일은 친구에게 보이지 않는다
export function isPrivate(todo: { visibility: Todo['visibility'] | null }): boolean {
  return getVisibility(todo) === 'PRIVATE';
}

export function withVisibilityToggled<T extends { visibility: Todo['visibility'] | null }>(
  todo: T,
): T {
  return { ...todo, visibility: isPrivate(todo) ? 'PUBLIC' : 'PRIVATE' };
}

// 종일이 아닌 시각만 비교한다. 종일끼리는 남은 시각 값이 달라도 바뀐 것이 아니다
export function hasScheduleChanged(
  next: Pick<Todo, 'isAllDay'> & { scheduledTime: string | null },
  previous: Pick<Todo, 'isAllDay'> & { scheduledTime: string | null },
): boolean {
  return (
    next.isAllDay !== previous.isAllDay ||
    (!next.isAllDay && next.scheduledTime !== previous.scheduledTime)
  );
}

// 시트 route의 대상 할 일. 목록에서 사라졌으면(삭제·다른 날짜) null
export function findTodo(todos: readonly Todo[], todoId: number): Todo | null {
  return todos.find((todo) => todo.id === todoId) ?? null;
}

export function findSubTodo(
  todo: Pick<Todo, 'subTodos'> | null,
  subTodoId: number,
): SubTodo | null {
  return todo?.subTodos.find((subTodo) => subTodo.id === subTodoId) ?? null;
}

export function isRecurringTodo(todo: Pick<Todo, 'recurrenceGroupId'>): boolean {
  return todo.recurrenceGroupId != null;
}

export function isMultiDayTodo(todo: Pick<Todo, 'startDate' | 'endDate'>): boolean {
  return todo.endDate != null && todo.endDate !== todo.startDate;
}

export function getShiftedEndDate(
  todo: Pick<Todo, 'startDate' | 'endDate'>,
  startDate: string,
): string | null {
  return todo.endDate == null
    ? null
    : addDaysToDateKey(startDate, diffDateKeysInDays(todo.startDate, todo.endDate));
}

// 서버 응답 전의 임시 행. 임시 id로는 요청을 보낼 수 없다
export function isOptimisticTodo(todo: Pick<Todo, 'id'>): boolean {
  return todo.id < 0;
}

// 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다. 여러 날 할 일은 시작일 목록만 낙관적으로 바뀌어 끝낸 것은 완료로 본다
export function isLastOpenTodo(todos: readonly Todo[], completedTodoId: number): boolean {
  return (
    todos.some((todo) => todo.id === completedTodoId) &&
    todos.every((todo) => todo.id === completedTodoId || todo.completed)
  );
}

export function isTodoOnDate(todo: Pick<Todo, 'startDate' | 'endDate'>, date: string): boolean {
  return todo.startDate <= date && date <= (todo.endDate ?? todo.startDate);
}

// 서버가 준 벽시계는 어디서든 그 시각이고 칸을 비워 둔 시간 행만 순간을 시간대로 읽는다. 종일·시간 없음은 null
export function getLocalTime(
  todo: Pick<Todo, 'isAllDay' | 'localTime' | 'scheduledAt'>,
  timeZone: string,
): string | null {
  if (todo.isAllDay) {
    return null;
  }
  if (todo.localTime != null) {
    return todo.localTime;
  }
  return todo.scheduledAt == null ? null : toHHmm(todo.scheduledAt, timeZone);
}

// 완료 전이고 시간이 있으며 아직 지나지 않은 할 일이 있는가. 시각은 어디서든 그 시각이라 벽시계로 비교한다
export function hasUpcomingTimedTodo(
  todos: readonly Todo[],
  now: { dateKey: string; time: string; timeZone: string },
): boolean {
  return todos.some((todo) => {
    const localTime = getLocalTime(todo, now.timeZone);
    return (
      !todo.completed &&
      localTime != null &&
      (todo.startDate > now.dateKey || (todo.startDate === now.dateKey && localTime > now.time))
    );
  });
}

// 상세 화면은 피드 날짜를 모른다. 오늘이 기간 안이면 오늘 목록을, 아니면 시작일 목록을 먼저 고친다
export function getOptimisticListDate(
  todo: Pick<Todo, 'startDate' | 'endDate'>,
  todayKey: string,
): string {
  return isTodoOnDate(todo, todayKey) ? todayKey : todo.startDate;
}

// 오늘 할 일은 내일로, 다른 날 할 일은 오늘로 옮기고 새 시작일보다 앞선 끝 날짜는 지운다
export function getTodayToggleDates(
  todo: Pick<Todo, 'startDate' | 'endDate'>,
  todayKey: string,
): Pick<Todo, 'startDate' | 'endDate'> {
  const startDate = todo.startDate === todayKey ? addDaysToDateKey(todayKey, 1) : todayKey;
  return {
    startDate,
    endDate: todo.endDate != null && todo.endDate < startDate ? null : todo.endDate,
  };
}

const MIN_REORDERABLE_COUNT = 2;

export function canReorderTodos(todos: readonly Pick<Todo, 'id'>[]) {
  return todos.length >= MIN_REORDERABLE_COUNT;
}

export const TodoPolicy = {
  canReorderTodos,
  getVisibility,
  isPrivate,
  withVisibilityToggled,
  hasScheduleChanged,
  findTodo,
  findSubTodo,
  getOptimisticListDate,
  isTodoOnDate,
  isRecurringTodo,
  isMultiDayTodo,
  getShiftedEndDate,
  getTodayToggleDates,
  isOptimisticTodo,
  isLastOpenTodo,
  getLocalTime,
  hasUpcomingTimedTodo,
} as const;
