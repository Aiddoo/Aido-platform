import type {
  AiUsageResponse,
  DailyCompletionSummary as DailyCompletionSummaryDTO,
  DailyCompletionsRangeResponse,
  ParseTodoResponse,
  Todo,
  TodoSummaryResponse,
} from '@aido/validators';

import type {
  AiUsage,
  DailyCompletionSummary,
  DailyCompletionsResult,
  ParsedTodoResult,
  TodoItem,
  TodoSummary,
} from '../models/todo.model';
import { toSubTodo } from './sub-todo.mapper';

export const toTodoItem = (dto: Todo): TodoItem => ({
  id: dto.id,
  title: dto.title,
  startDate: dto.startDate,
  endDate: dto.endDate,
  category: dto.category,
  completed: dto.completed,
  scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime) : null,
  isAllDay: dto.isAllDay,
  visibility: dto.visibility,
  recurrenceGroupId: dto.recurrenceGroupId,
  subTodos: dto.items.map(toSubTodo),
  subTodoStats: dto.itemStats,
});

export const toTodoItems = (dtos: Todo[]): TodoItem[] => dtos.map(toTodoItem);

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

export const toAiUsage = (dto: AiUsageResponse): AiUsage => dto.data;

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
  })),
});
