import type {
  AiUsageResponse,
  DailyCompletionSummary as DailyCompletionSummaryDTO,
  DailyCompletionsRangeResponse,
  ParseTodoResponse,
  Todo,
} from '@aido/validators';

import type {
  AiUsage,
  DailyCompletionSummary,
  DailyCompletionsResult,
  ParsedTodoResult,
  TodoItem,
} from '../models/todo.model';

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
});

export const toTodoItems = (dtos: Todo[]): TodoItem[] => dtos.map(toTodoItem);

export const toParsedTodoResult = (dto: ParseTodoResponse): ParsedTodoResult => ({
  data: dto.data,
  meta: dto.meta,
});

export const toAiUsage = (dto: AiUsageResponse): AiUsage => dto.data;

// Daily Completion
export const toDailyCompletionSummary = (
  dto: DailyCompletionSummaryDTO,
): DailyCompletionSummary => ({
  date: dto.date,
  totalTodos: dto.totalTodos,
  completedTodos: dto.completedTodos,
  isComplete: dto.isComplete,
  completionRate: dto.completionRate,
});

export const toDailyCompletionsResult = (
  dto: DailyCompletionsRangeResponse,
): DailyCompletionsResult => ({
  completions: dto.completions.map(toDailyCompletionSummary),
  totalCompleteDays: dto.totalCompleteDays,
  dateRange: dto.dateRange,
});
