import {
  dateSchema,
  todoVisibilitySchema,
  type DailyCompletionSummary as DailyCompletionSummaryResponse,
  type DailyCompletionsRangeResponse,
  type TodoSummaryResponse,
} from '@aido/api';
import { z } from 'zod';

import { subTodoSchema, subTodoStatsSchema } from './sub-todo.model';
import { todoCategorySchema as categorySchema } from './todo-category.model';

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
  scheduledAtMs: z.int().nullable(),
  isAllDay: z.boolean(),
  visibility: todoVisibilitySchema,
  recurrenceGroupId: z.string().nullable(),
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

export type DailyCompletionSummary = DailyCompletionSummaryResponse;
export type DailyCompletionsResult = DailyCompletionsRangeResponse;
export type TodoSummary = TodoSummaryResponse;

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

export function hasSubTodos(todo: Todo): boolean {
  return todo.subTodoStats.total > 0;
}

/** 그날 할 일이 하나 이상 있고 모두 끝냈는지. 할 일이 하나뿐인 날도 다 끝낸 날이다 */
export function areAllTodosCompleted(todos: readonly Todo[]): boolean {
  return todos.length > 0 && todos.every((todo) => todo.completed);
}

export const TodoPolicy = {
  isRecurring: isRecurringTodo,
  hasSubTodos,
  areAllCompleted: areAllTodosCompleted,
} as const;
