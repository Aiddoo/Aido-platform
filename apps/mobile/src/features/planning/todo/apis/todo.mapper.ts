import {
  type CreateTodoInput,
  type DailyCompletionSummary as DailyCompletionSummaryDTO,
  type DailyCompletionsRangeResponse,
  type FriendTodoListResponse,
  type Todo as TodoDto,
  type TodoDetailsResponse,
  type TodoListResponse,
  type TodoOverviewResponse,
  type TodoSummaryResponse,
} from '@aido/api';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toNullableInstant } from '@src/shared/date/instant';

import { DailyCompletionPolicy } from '../domains/daily-completion.model';
import {
  type DailyCompletionSummary,
  type DailyCompletionsResult,
} from '../domains/daily-completion.model';
import {
  getScheduledTime,
  type Todo,
  type TodoDetails,
  type TodoOverview,
  TodoPolicy,
  type TodoSummary,
  type TodoListResult,
} from '../domains/todo.model';
import type { TodoFormValues } from '../schemas/todo-form.schema';
import { toSubTodo } from './sub-todo.mapper';
import { toRepeat, toRepeatDto } from './todo-repeat.mapper';

export function toTodo(dto: TodoDto): Todo {
  return {
    id: dto.id,
    title: dto.title,
    startDate: dateKeySchema.parse(dto.startDate),
    endDate: dto.endDate == null ? null : dateKeySchema.parse(dto.endDate),
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
    date: dateKeySchema.parse(dto.date),
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
    dateRange: {
      startDate: dateKeySchema.parse(dto.dateRange.startDate),
      endDate: dateKeySchema.parse(dto.dateRange.endDate),
    },
  };
}

export function toTodoOverview(dto: TodoOverviewResponse): TodoOverview {
  return {
    hasTodo: dto.hasTodo,
    hasCompletedTodo: dto.hasCompletedTodo,
    hasActiveRepeat: dto.hasActiveRepeat,
  };
}

export function toTodoSummary(dto: TodoSummaryResponse): TodoSummary {
  return {
    date: dateKeySchema.parse(dto.date),
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

/** 할 일 만들기 요청. 작성 시트·반복 작성·메모 옮기기가 모두 이 모양으로 보낸다 */
export function toCreateTodoRequest(values: TodoFormValues): CreateTodoInput {
  const scheduledTime = getScheduledTime(values);
  return {
    title: values.title,
    categoryId: values.categoryId,
    startDate: values.startDate,
    ...(values.endDate != null && { endDate: values.endDate }),
    ...(scheduledTime != null && { scheduledTime }),
    isAllDay: values.isAllDay,
    visibility: values.visibility,
    ...(values.repeat != null && { repeat: toRepeatDto(values.repeat) }),
  };
}

/** 수정 폼의 처음 값. 시각은 서버 벽시계를, 칸을 비워 둔 옛 시간 행은 시간대로 읽은 시각을 쓴다 */
export function toTodoFormValues(todo: Todo, timeZone: string): TodoFormValues {
  return {
    title: todo.title,
    categoryId: todo.category.id,
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: TodoPolicy.getLocalTime(todo, timeZone),
    isAllDay: todo.isAllDay,
    visibility: todo.visibility,
    repeat: todo.repeat,
  };
}
