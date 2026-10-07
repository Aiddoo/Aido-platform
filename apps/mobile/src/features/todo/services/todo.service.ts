import {
  aiUsageResponseSchema,
  type CreateRecurringTodoInput,
  type CreateTodoInput,
  createRecurringTodoResponseSchema,
  dailyCompletionsRangeResponseSchema,
  deleteTodoResponseSchema,
  type GetTodosQuery,
  parseTodoResponseSchema,
  type ReorderTodoInput,
  reorderTodoResponseSchema,
  type ToggleTodoCompleteInput,
  todoDetailsResponseSchema,
  todoListResponseSchema,
  createTodoResponseSchema,
  todoSummaryResponseSchema,
  type UpdateTodoInput,
  type UpdateTodoScheduleInput,
  updateTodoResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type {
  AiUsage,
  DailyCompletionsResult,
  ParsedTodoResult,
  TodoItem,
  TodoDetails,
  TodoSummary,
  TodosResult,
} from '../models/todo.model';
import {
  toAiUsage,
  toDailyCompletionsResult,
  toParsedTodoResult,
  toTodoItem,
  toTodoDetails,
  toTodoItems,
  toTodoSummary,
} from './todo.mapper';

export class TodoService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getTodos = async (
    params: GetTodosQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodosResult, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos', {
      signal,
      params: {
        cursor: params.cursor,
        size: params.size,
        completed: params.completed,
        categoryId: params.categoryId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid getTodos response: ${parsed.error.message}`);
    }

    return ok({
      todos: toTodoItems(parsed.data.items),
      hasNext: parsed.data.pagination.hasNext,
      nextCursor: parsed.data.pagination.nextCursor,
    });
  };

  getFriendTodos = async (
    friendUserId: string,
    params: GetTodosQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodosResult, ApiError>> => {
    const result = await this.#httpClient.get(`v1/todos/friends/${friendUserId}`, {
      signal,
      params: {
        cursor: params.cursor,
        size: params.size,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getFriendTodos response: ${parsed.error.message}`,
      );
    }

    return ok({
      todos: toTodoItems(parsed.data.items),
      hasNext: parsed.data.pagination.hasNext,
      nextCursor: parsed.data.pagination.nextCursor,
    });
  };

  toggleTodoComplete = async (
    todoId: number,
    body: ToggleTodoCompleteInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/complete`, body);

    if (!result.ok) {
      return result;
    }

    const parsed = createTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid toggleTodoComplete response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  createTodo = async (params: CreateTodoInput): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.post('v1/todos', params);

    if (!result.ok) {
      return result;
    }

    const parsed = createTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid createTodo response: ${parsed.error.message}`);
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  updateTodo = async (
    todoId: number,
    input: UpdateTodoInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}`, input);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid updateTodo response: ${parsed.error.message}`);
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  updateTodoSchedule = async (
    todoId: number,
    input: UpdateTodoScheduleInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/schedule`, input);

    if (!result.ok) {
      return result;
    }

    const parsed = updateTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid updateTodoSchedule response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  deleteTodo = async (todoId: number): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.delete(`v1/todos/${todoId}`);

    if (!result.ok) {
      return result;
    }

    const parsed = deleteTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid deleteTodo response: ${parsed.error.message}`);
    }

    return ok(undefined);
  };

  parseTodo = async (
    text: string,
    categoryId?: number,
  ): Promise<Result<ParsedTodoResult, ApiError>> => {
    const result = await this.#httpClient.post('v1/ai/parse-todo', {
      text,
      ...(categoryId != null && { categoryId }),
    });

    if (!result.ok) {
      return result;
    }

    const parsed = parseTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid parseTodo response: ${parsed.error.message}`);
    }

    return ok(toParsedTodoResult(parsed.data));
  };

  getAiUsage = async (signal?: AbortSignal): Promise<Result<AiUsage, ApiError>> => {
    const result = await this.#httpClient.get('v1/ai/usage', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = aiUsageResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid getAiUsage response: ${parsed.error.message}`);
    }

    return ok(toAiUsage(parsed.data));
  };

  getDailyCompletions = async (
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<Result<DailyCompletionsResult, ApiError>> => {
    const result = await this.#httpClient.get('v1/daily-completions', {
      signal,
      params: { startDate, endDate },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = dailyCompletionsRangeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getDailyCompletions response: ${parsed.error.message}`,
      );
    }

    return ok(toDailyCompletionsResult(parsed.data));
  };

  /** 친구의 일일 완료 현황 — 공개(PUBLIC) 할 일 기준 집계 (친구 캘린더 마커용) */
  getFriendDailyCompletions = async (
    friendUserId: string,
    startDate: string,
    endDate: string,
    signal?: AbortSignal,
  ): Promise<Result<DailyCompletionsResult, ApiError>> => {
    const result = await this.#httpClient.get(`v1/daily-completions/friends/${friendUserId}`, {
      signal,
      params: { startDate, endDate },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = dailyCompletionsRangeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getFriendDailyCompletions response: ${parsed.error.message}`,
      );
    }

    return ok(toDailyCompletionsResult(parsed.data));
  };

  /** 오늘의 할 일 요약 (홈 위젯 스냅샷) — 진행률·스트릭·상위 할 일을 한 번에 */
  getTodoSummary = async (signal?: AbortSignal): Promise<Result<TodoSummary, ApiError>> => {
    const result = await this.#httpClient.get('v1/todos/summary', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = todoSummaryResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid getTodoSummary response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoSummary(parsed.data));
  };

  createRecurringTodo = async (
    params: CreateRecurringTodoInput,
  ): Promise<Result<TodoItem[], ApiError>> => {
    const result = await this.#httpClient.post('v1/todos/recurring', params);

    if (!result.ok) {
      return result;
    }

    const parsed = createRecurringTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoService] Invalid createRecurringTodo response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItems(parsed.data.todos));
  };

  reorderTodo = async (
    todoId: number,
    input: ReorderTodoInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/reorder`, input);

    if (!result.ok) {
      return result;
    }

    const parsed = reorderTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid reorderTodo response: ${parsed.error.message}`);
    }

    return ok(toTodoItem(parsed.data.todo));
  };

  getTodoDetails = async (
    todoId: number,
    signal?: AbortSignal,
  ): Promise<Result<TodoDetails, ApiError>> => {
    const response = await this.#httpClient.get(`v1/todos/${todoId}/details`, { signal });

    if (!response.ok) {
      return response;
    }

    const parsed = todoDetailsResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoService] Invalid todo details: ${parsed.error.message}`);
    }

    return ok(toTodoDetails(parsed.data));
  };
}
