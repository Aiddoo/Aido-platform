import {
  type DailyCompletionSummary as DailyCompletionSummaryDTO,
  type DailyCompletionsRangeResponse,
  type FriendTodoListResponse,
  type Todo as TodoDto,
  type TodoDetailsResponse,
  type TodoListResponse,
  type TodoSummaryResponse,
} from '@aido/api';
import { toNullableInstant } from '@src/shared/date/instant';

import { DailyCompletionPolicy } from '../domains/daily-completion.model';
import {
  type DailyCompletionSummary,
  type DailyCompletionsResult,
} from '../domains/daily-completion.model';
import {
  type Todo,
  type TodoDetails,
  type TodoSummary,
  type TodoListResult,
} from '../domains/todo.model';
import { toSubTodo } from './sub-todo.mapper';
import { toRepeat } from './todo-repeat.mapper';

export function toTodo(dto: TodoDto): Todo {
  return {
    id: dto.id,
    title: dto.title,
    startDate: dto.startDate,
    endDate: dto.endDate,
    category: { id: dto.category.id, name: dto.category.name, color: dto.category.color },
    completed: dto.completed,
    localTime: dto.scheduledLocalTime ?? null,
    scheduledAt: toNullableInstant(dto.scheduledTime),
    isAllDay: dto.isAllDay,
    visibility: dto.visibility,
    recurrenceGroupId: dto.recurrenceGroupId,
    // 친구 할 일에는 키가 없다
    repeat: dto.repeat == null ? null : toRepeat(dto.repeat),
    subTodos: dto.items.map(toSubTodo),
    commentCount: dto.commentCount,
  };
}

function toDailyCompletionSummary(dto: DailyCompletionSummaryDTO): DailyCompletionSummary {
  return {
    date: dto.date,
    totalTodos: dto.totalTodos,
    completedTodos: dto.completedTodos,
    isComplete: dto.isComplete,
    completionRate: dto.completionRate,
    categoryColors: DailyCompletionPolicy.toCategoryColors(dto.categoryColors),
  };
}

export function toDailyCompletionsResult(
  dto: DailyCompletionsRangeResponse,
): DailyCompletionsResult {
  return {
    completions: dto.completions.map(toDailyCompletionSummary),
    totalCompleteDays: dto.totalCompleteDays,
    dateRange: dto.dateRange,
  };
}

export function toTodoSummary(dto: TodoSummaryResponse): TodoSummary {
  return {
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
  };
}

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
