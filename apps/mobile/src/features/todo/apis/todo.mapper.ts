import type {
  DailyCompletionSummary as DailyCompletionSummaryDTO,
  DailyCompletionsRangeResponse,
  ParseTodoResponse,
  Todo as TodoDto,
  TodoDetailsResponse,
  TodoListResponse,
  TodoSummaryResponse,
} from '@aido/api';

import type {
  DailyCompletionSummary,
  DailyCompletionsResult,
  ParsedTodoResult,
  Todo,
  TodoDetails,
  TodoSummary,
  TodoListResult,
} from '../domains/todo.model';
import { toSubTodo } from './sub-todo.mapper';

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
  subTodos: dto.items.map(toSubTodo),
  subTodoStats: { total: dto.itemStats.total, completed: dto.itemStats.completed },
  commentCount: dto.commentCount,
});

export const toTodos = (dtos: TodoDto[]): Todo[] => dtos.map(toTodo);

export const toParsedTodoResult = (dto: ParseTodoResponse): ParsedTodoResult => ({
  data: {
    title: dto.data.title,
    startDate: new Date(dto.data.startDate),
    endDate: dto.data.endDate ? new Date(dto.data.endDate) : null,
    scheduledTime: dto.data.scheduledTime,
    isAllDay: dto.data.isAllDay,
    isRecurring: dto.data.isRecurring,
    recurrence: dto.data.recurrence
      ? {
          daysOfWeek: dto.data.recurrence.daysOfWeek,
          endDate: new Date(dto.data.recurrence.endDate),
        }
      : null,
    ...(dto.data.categoryId != null && { categoryId: dto.data.categoryId }),
  },
  meta: dto.meta,
});

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

export function toTodoListResult(dto: TodoListResponse): TodoListResult {
  return {
    todos: dto.items.map(toTodo),
    hasNext: dto.pagination.hasNext,
    nextCursor: dto.pagination.nextCursor,
  };
}
