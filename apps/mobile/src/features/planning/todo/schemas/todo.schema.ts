import {
  dailyCompletionsRangeResponseSchema,
  dailyCompletionSummarySchema as dailyCompletionSummaryContractSchema,
  multiDayTodoSpanSchema as multiDayTodoSpanContractSchema,
  todoDetailsResponseSchema,
  todoListResponseSchema,
  todoSchema as todoContractSchema,
  todoSummaryResponseSchema,
} from '@aido/api';
import { todoCategorySchema as categorySchema } from '@src/features/planning/category/schemas/todo-category.schema';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

import { subTodoSchema, subTodoStatsSchema } from './sub-todo.schema';
import { todoRepeatSchema } from './todo-repeat.schema';

const dateSchema = z.iso.date();
const todoCategorySchema = categorySchema.pick({ id: true, name: true, color: true });
/**
 * 서버 할 일에서 앱이 쓰는 칸만 고른다. 날짜는 `YYYY-MM-DD`로 검증하고, 시각은 Instant로, 하위 항목은 앱 이름으로 바꾼다.
 * 반복 규칙은 친구 할 일과 구 서버 응답에서 키가 없어 앱에서는 null로 읽는다.
 */
export const todoSchema = todoContractSchema
  .pick({
    id: true,
    title: true,
    completed: true,
    isAllDay: true,
    visibility: true,
    recurrenceGroupId: true,
    commentCount: true,
  })
  .extend({
    startDate: dateSchema,
    endDate: dateSchema.nullable(),
    category: todoCategorySchema,
    /** 사용자가 고른 벽시계(HH:mm). 어디서든 이 시각이라 표시와 수정 기본값은 이 값만 쓴다. 종일은 null */
    localTime: z.iso.time({ precision: -1 }).nullable(),
    /** 서버가 벽시계 칸을 비워 둔 시간 행의 시각을 표시 때 시간대로 계산하려고 순간을 함께 둔다. 시간 없는 할 일은 null */
    scheduledAt: instantSchema.nullable(),
    /** 반복 규칙. 단일 할 일이나 규칙이 없는 옛 묶음, 친구 할 일은 null */
    repeat: todoRepeatSchema.nullable(),
    subTodos: z.array(subTodoSchema),
    subTodoStats: subTodoStatsSchema,
  });
export type Todo = z.infer<typeof todoSchema>;
const optimisticTodoSchema = todoSchema.extend({ optimistic: z.literal(true).readonly() });
export type OptimisticTodo = z.infer<typeof optimisticTodoSchema>;

export const todoListResultSchema = todoListResponseSchema.shape.pagination
  .pick({ hasNext: true, nextCursor: true })
  .extend({ todos: z.array(todoSchema) });
export type TodoListResult = z.infer<typeof todoListResultSchema>;

/** 계정에 할 일이 하나라도 있는지·완료한 할 일이 있는지. 기기와 무관한 서버 기록이다 */
const todoExistenceSchema = z.object({
  hasTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
});
export type TodoExistence = z.infer<typeof todoExistenceSchema>;

const dailyCompletionSummarySchema = dailyCompletionSummaryContractSchema.pick({
  date: true,
  totalTodos: true,
  completedTodos: true,
  isComplete: true,
  completionRate: true,
  categoryColors: true,
});
export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummarySchema>;

/** 여러 날 할 일은 mapper가 기간 안의 날에 펼쳐 넣어 결과에 따로 두지 않는다 */
export const dailyCompletionsResultSchema = dailyCompletionsRangeResponseSchema
  .pick({ totalCompleteDays: true, dateRange: true })
  .extend({ completions: z.array(dailyCompletionSummarySchema) });
export type DailyCompletionsResult = z.infer<typeof dailyCompletionsResultSchema>;

const multiDayTodoSpanSchema = multiDayTodoSpanContractSchema
  .pick({ completed: true, categoryColor: true })
  .extend({ startDate: dateSchema, endDate: dateSchema });
export type MultiDayTodoSpan = z.infer<typeof multiDayTodoSpanSchema>;

const todoSummarySchema = todoSummaryResponseSchema.pick({
  date: true,
  totalTodos: true,
  completedTodos: true,
  completionRate: true,
  isComplete: true,
  currentStreak: true,
  topTodos: true,
});
export type TodoSummary = z.infer<typeof todoSummarySchema>;

const todoDetailsSchema = todoDetailsResponseSchema
  .pick({ permissions: true, metrics: true })
  .extend({
    todo: todoSchema,
    owner: todoDetailsResponseSchema.shape.owner.pick({ id: true, name: true, profileImage: true }),
  });
export type TodoDetails = z.infer<typeof todoDetailsSchema>;
