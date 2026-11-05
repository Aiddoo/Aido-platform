import { TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { sortBy, uniq } from 'es-toolkit';
import { z } from 'zod';

import { subTodoSchema, subTodoStatsSchema } from './sub-todo.model';
import { todoCategorySchema as categorySchema } from './todo-category.model';
import { todoRepeatSchema } from './todo-repeat.model';

const dateSchema = z.iso.date();
const todoVisibilitySchema = z.enum(TODO_VISIBILITIES);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

export const todoCategorySchema = categorySchema.pick({ id: true, name: true, color: true });
export type TodoCategory = z.infer<typeof todoCategorySchema>;

export const todoSchema = z.object({
  id: z.number(),
  title: z.string(),
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  category: todoCategorySchema,
  completed: z.boolean(),
  /** 사용자가 고른 벽시계(HH:mm). 어디서든 이 시각이라 표시와 수정 기본값은 이 값만 쓴다. 종일은 null */
  localTime: z.iso.time({ precision: -1 }).nullable(),
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
  recurrenceGroupId: z.string().nullable(),
  /** 반복 규칙. 단일 할 일이나 규칙이 없는 옛 묶음, 친구 할 일은 null */
  repeat: todoRepeatSchema.nullable(),
  subTodos: z.array(subTodoSchema),
  subTodoStats: subTodoStatsSchema,
  commentCount: z.int().nonnegative(),
});
export type Todo = z.infer<typeof todoSchema>;
const optimisticTodoSchema = todoSchema.extend({ optimistic: z.literal(true).readonly() });
export type OptimisticTodo = z.infer<typeof optimisticTodoSchema>;

export const todoListResultSchema = z.object({
  todos: z.array(todoSchema),
  hasNext: z.boolean(),
  nextCursor: z.number().nullable(),
});
export type TodoListResult = z.infer<typeof todoListResultSchema>;

/** 계정에 할 일이 하나라도 있는지·완료한 할 일이 있는지. 기기와 무관한 서버 기록이다 */
export const todoExistenceSchema = z.object({
  hasTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
});
export type TodoExistence = z.infer<typeof todoExistenceSchema>;

export const dailyCompletionSummarySchema = z.object({
  date: z.string(),
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  isComplete: z.boolean(),
  completionRate: z.number().min(0).max(100),
  categoryColors: z.array(z.string()),
});
export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummarySchema>;

export const dailyCompletionsResultSchema = z.object({
  completions: z.array(dailyCompletionSummarySchema),
  totalCompleteDays: z.int().min(0),
  dateRange: z.object({ startDate: z.string(), endDate: z.string() }),
});
export type DailyCompletionsResult = z.infer<typeof dailyCompletionsResultSchema>;

export const todoSummarySchema = z.object({
  date: z.string(),
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  completionRate: z.number().min(0).max(100),
  isComplete: z.boolean(),
  currentStreak: z.int().min(0),
  topTodos: z.array(
    z.object({
      id: z.int(),
      title: z.string(),
      completed: z.boolean(),
      categoryColor: z.string(),
    }),
  ),
});
export type TodoSummary = z.infer<typeof todoSummarySchema>;

export const todoDetailsSchema = z.object({
  todo: todoSchema,
  owner: z.object({
    id: z.string(),
    name: z.string().nullable(),
    profileImage: z.string().nullable(),
  }),
  permissions: z.object({
    canEdit: z.boolean(),
    canComment: z.boolean(),
    canNudge: z.boolean(),
  }),
  metrics: z.object({ viewCount: z.number(), commentCount: z.number() }),
});
export type TodoDetails = z.infer<typeof todoDetailsSchema>;

export function isRecurringTodo(todo: Todo): boolean {
  return todo.recurrenceGroupId != null;
}

/** 서버 응답 전의 임시 행. 임시 id로는 요청을 보낼 수 없다 */
export function isOptimisticTodo(todo: Pick<Todo, 'id'>): boolean {
  return todo.id < 0;
}

export function hasSubTodos(todo: Todo): boolean {
  return todo.subTodoStats.total > 0;
}

/**
 * 이 할 일을 끝내면 그날 목록이 모두 끝나는지. 할 일이 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다.
 * 여러 날에 걸친 할 일은 시작일 목록만 낙관적으로 바뀌므로 끝낸 할 일은 목록 값과 무관하게 완료로 본다.
 */
export function completesAllTodos(todos: readonly Todo[], completedTodoId: number): boolean {
  return (
    todos.some((todo) => todo.id === completedTodoId) &&
    todos.every((todo) => todo.id === completedTodoId || todo.completed)
  );
}

/**
 * 그날 목록으로 달력 요약을 다시 계산한다(서버 buildDailyCompletionsRange와 같은 규칙).
 * 서버는 여러 날 할 일을 시작일에만 세므로 시작일이 그날인 할 일만 센다. 할 일이 없는 날은 요약이 없다.
 */
export function withDailyCompletionFromTodos(
  result: DailyCompletionsResult,
  date: string,
  todos: readonly Todo[],
): DailyCompletionsResult {
  if (date < result.dateRange.startDate || date > result.dateRange.endDate) {
    return result;
  }
  const dayTodos = todos.filter((todo) => todo.startDate === date);
  const totalTodos = dayTodos.length;
  const completedTodos = dayTodos.filter((todo) => todo.completed).length;
  const others = result.completions.filter((completion) => completion.date !== date);
  const completions =
    totalTodos === 0
      ? others
      : sortBy(
          [
            ...others,
            {
              date,
              totalTodos,
              completedTodos,
              isComplete: totalTodos === completedTodos,
              completionRate: Math.round((completedTodos / totalTodos) * 100),
              categoryColors: uniq(dayTodos.map((todo) => todo.category.color)),
            },
          ],
          [(completion) => completion.date],
        );

  return {
    ...result,
    completions,
    totalCompleteDays: completions.filter((completion) => completion.isComplete).length,
  };
}

/** 완료 전이고 시간이 있으며 아직 지나지 않은 할 일이 있는가. 시각은 어디서든 그 시각이라 벽시계로 비교한다 */
export function hasUpcomingTimedTodo(
  todos: readonly Todo[],
  now: { dateKey: string; time: string },
): boolean {
  return todos.some(
    (todo) =>
      !todo.completed &&
      todo.localTime != null &&
      (todo.startDate > now.dateKey ||
        (todo.startDate === now.dateKey && todo.localTime > now.time)),
  );
}

export const TodoPolicy = {
  isRecurringTodo,
  isOptimisticTodo,
  withDailyCompletionFromTodos,
  hasSubTodos,
  completesAllTodos,
  hasUpcomingTimedTodo,
} as const;
