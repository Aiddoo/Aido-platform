import type { AiUsageResponse, ParseTodoResponse, Todo } from '@aido/validators';

import type { AiUsage, ParsedTodoResult, TodoItem } from '../models/todo.model';

// ============================================================
// Todo Mappers
// ============================================================

/** 서버 Todo DTO → 프론트엔드 TodoItem 도메인 모델 */
export const toTodoItem = (dto: Todo): TodoItem => ({
  id: dto.id,
  title: dto.title,
  category: dto.category,
  completed: dto.completed,
  scheduledTime: dto.scheduledTime ? new Date(dto.scheduledTime) : null,
  isAllDay: dto.isAllDay,
  visibility: dto.visibility,
});

/** 서버 Todo DTO 배열 → 프론트엔드 TodoItem 도메인 모델 배열 */
export const toTodoItems = (dtos: Todo[]): TodoItem[] => dtos.map(toTodoItem);

// ============================================================
// AI Parsing Mappers
// ============================================================

/** 서버 ParseTodoResponse → 프론트엔드 ParsedTodoResult 도메인 모델 */
export const toParsedTodoResult = (dto: ParseTodoResponse): ParsedTodoResult => ({
  data: dto.data,
  meta: dto.meta,
});

/** 서버 AiUsageResponse → 프론트엔드 AiUsage 도메인 모델 */
export const toAiUsage = (dto: AiUsageResponse): AiUsage => dto.data;
