import { TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { todoCategorySchema as categorySchema } from '@src/features/planning/category/schemas/todo-category.schema';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { subTodoSchema, subTodoStatsSchema } from './sub-todo.schema';
import { todoRepeatSchema } from './todo-repeat.schema';

const dateSchema = z.iso.date();
const todoVisibilitySchema = z.enum(TODO_VISIBILITIES);
const todoCategorySchema = categorySchema.pick({ id: true, name: true, color: true });
export const todoSchema = z.object({
  id: z.number(),
  title: z.string(),
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  category: todoCategorySchema,
  completed: z.boolean(),
  /** 사용자가 고른 벽시계(HH:mm). 어디서든 이 시각이라 표시와 수정 기본값은 이 값만 쓴다. 종일은 null */
  localTime: z.iso.time({ precision: -1 }).nullable(),
  /** 벽시계 칸이 없는 옛 서버 응답의 시각을 표시 때 시간대로 계산하려고 순간을 함께 둔다. 시간 없는 할 일은 null */
  scheduledAt: instantSchema.nullable(),
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
const todoExistenceSchema = z.object({
  hasTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
});
export type TodoExistence = z.infer<typeof todoExistenceSchema>;

const dailyCompletionSummarySchema = z.object({
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

const multiDayTodoSpanSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  completed: z.boolean(),
  categoryColor: z.string(),
});
export type MultiDayTodoSpan = z.infer<typeof multiDayTodoSpanSchema>;

const todoSummarySchema = z.object({
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

const todoDetailsSchema = z.object({
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
