import {
  dateSchema,
  todoVisibilitySchema,
  type DailyCompletionSummary as DailyCompletionSummaryResponse,
  type DailyCompletionsRangeResponse,
  type TodoSummaryResponse,
} from '@aido/api';
import { z } from 'zod';

import { SubTodoPolicy, subTodoSchema, subTodoStatsSchema } from './sub-todo.model';

export { type SubTodo, SubTodoPolicy, type SubTodoStats } from './sub-todo.model';

export { todoVisibilitySchema };
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

export function canAddSubTodo(todo: Todo): boolean {
  return SubTodoPolicy.canAddSubTodo(todo);
}

export function calculateSubTodoProgress(todo: Todo): number {
  return SubTodoPolicy.completionProgress(todo);
}

export const TodoPolicy = {
  isRecurring: isRecurringTodo,
  hasSubTodos,
  canAddSubTodo,
  completionProgress: calculateSubTodoProgress,
} as const;
