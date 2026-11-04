import {
  createTodoResponseSchema,
  type DailyCompletionSummary as DailyCompletionSummaryDTO,
  type DailyCompletionsRangeResponse,
  type FriendTodoListResponse,
  reorderTodoResponseSchema,
  type Todo as TodoDto,
  type TodoDetailsResponse,
  todoDetailsResponseSchema,
  todoListResponseSchema,
  type TodoListResponse,
  todoRepeatSchema,
  todoSchema,
  todoSeriesResponseSchema,
  type TodoSummaryResponse,
  updateTodoResponseSchema,
} from '@aido/api';
import { z } from 'zod';

import type {
  DailyCompletionSummary,
  DailyCompletionsResult,
  Todo,
  TodoDetails,
  TodoSummary,
  TodoListResult,
} from '../domains/todo.model';
import { toSubTodo } from './sub-todo.mapper';
import { toRepeat } from './todo-series.mapper';

/**
 * 새 서버가 더한 모르는 반복 빈도 하나 때문에 응답 전체를 버리지 않는다. 모르는 규칙은 규칙을 모르는 회차(`repeat: null`)로 읽고,
 * 화면은 이미 이 경우를 `↻ 반복`으로 그린다.
 */
const lenientRepeatSchema = todoRepeatSchema.nullable().optional().catch(null);
const lenientTodoSchema = todoSchema.extend({ repeat: lenientRepeatSchema });

export const todoListEnvelopeSchema = todoListResponseSchema.extend({
  items: z.array(lenientTodoSchema),
});
export const createTodoEnvelopeSchema = createTodoResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const updateTodoEnvelopeSchema = updateTodoResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const reorderTodoEnvelopeSchema = reorderTodoResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const todoDetailsEnvelopeSchema = todoDetailsResponseSchema.extend({
  todo: lenientTodoSchema,
});
export const todoSeriesEnvelopeSchema = todoSeriesResponseSchema.extend({
  repeat: todoRepeatSchema.nullable().catch(null),
});

export const toTodo = (dto: TodoDto): Todo => ({
  id: dto.id,
  title: dto.title,
  startDate: dto.startDate,
  endDate: dto.endDate,
  category: { id: dto.category.id, name: dto.category.name, color: dto.category.color },
  completed: dto.completed,
  scheduledAtMs: dto.scheduledTime == null ? null : Date.parse(dto.scheduledTime),
  isAllDay: dto.isAllDay,
  visibility: dto.visibility,
  recurrenceGroupId: dto.recurrenceGroupId,
  // 구 서버 응답과 친구 할 일에는 키가 없다
  repeat: dto.repeat == null ? null : toRepeat(dto.repeat),
  subTodos: dto.items.map(toSubTodo),
  subTodoStats: { total: dto.itemStats.total, completed: dto.itemStats.completed },
  commentCount: dto.commentCount,
});

export const toTodos = (dtos: TodoDto[]): Todo[] => dtos.map(toTodo);

export const toDailyCompletionSummary = (
  dto: DailyCompletionSummaryDTO,
): DailyCompletionSummary => ({
  date: dto.date,
  totalTodos: dto.totalTodos,
  completedTodos: dto.completedTodos,
  isComplete: dto.isComplete,
  completionRate: dto.completionRate,
  categoryColors: dto.categoryColors,
});

export const toDailyCompletionsResult = (
  dto: DailyCompletionsRangeResponse,
): DailyCompletionsResult => ({
  completions: dto.completions.map(toDailyCompletionSummary),
  totalCompleteDays: dto.totalCompleteDays,
  dateRange: dto.dateRange,
});

export const toTodoSummary = (dto: TodoSummaryResponse): TodoSummary => ({
  date: dto.date,
  totalTodos: dto.totalTodos,
  completedTodos: dto.completedTodos,
  completionRate: dto.completionRate,
  isComplete: dto.isComplete,
  currentStreak: dto.currentStreak,
  topTodos: dto.topTodos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    categoryColor: todo.categoryColor,
  })),
});

export function toTodoDetails(dto: TodoDetailsResponse): TodoDetails {
  return {
    todo: toTodo(dto.todo),
    owner: {
      id: dto.owner.id,
      name: dto.owner.name,
      profileImage: dto.owner.profileImage,
    },
    permissions: { ...dto.permissions },
    metrics: { ...dto.metrics },
  };
}

/** 친구 응답에는 규칙(`repeat`)과 회차 날짜가 없다 */
export function toFriendTodoListResult(dto: FriendTodoListResponse): TodoListResult {
  return {
    todos: dto.items.map(toTodo),
    hasNext: dto.pagination.hasNext,
    nextCursor: dto.pagination.nextCursor,
  };
}

export function toTodoListResult(dto: TodoListResponse): TodoListResult {
  return {
    todos: dto.items.map(toTodo),
    hasNext: dto.pagination.hasNext,
    nextCursor: dto.pagination.nextCursor,
  };
}
