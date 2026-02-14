import {
  type AiUsageResponse,
  aiUsageResponseSchema,
  type CreateTodoInput,
  dailyCompletionsRangeResponseSchema,
  type GetTodosQuery,
  type ParseTodoResponse,
  parseTodoResponseSchema,
  type Todo,
  type TodoListResponse,
  type ToggleTodoCompleteInput,
  todoListResponseSchema,
  todoSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type {
  AiUsage,
  DailyCompletionsResult,
  ParsedTodoResult,
  TodoItem,
  TodosResult,
} from '../models/todo.model';
import {
  toAiUsage,
  toDailyCompletionsResult,
  toParsedTodoResult,
  toTodoItem,
  toTodoItems,
} from './todo.mapper';
import type { TodoRepository } from './todo.repository';

export class TodoRepositoryImpl implements TodoRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async getTodos(params: GetTodosQuery): Promise<Result<TodosResult, ApiError>> {
    const result = await this.#httpClient.get<TodoListResponse>('v1/todos', {
      params: {
        cursor: params.cursor,
        size: params.size,
        completed: params.completed,
        categoryId: params.categoryId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    if (!result.ok) return result;

    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoRepository] Invalid getTodos response: ${parsed.error.message}`);
    }

    return ok({
      todos: toTodoItems(parsed.data.items),
      hasNext: parsed.data.pagination.hasNext,
      nextCursor: parsed.data.pagination.nextCursor,
    });
  }

  async getFriendTodos(
    friendUserId: string,
    params: GetTodosQuery,
  ): Promise<Result<TodosResult, ApiError>> {
    const result = await this.#httpClient.get<TodoListResponse>(
      `v1/todos/friends/${friendUserId}`,
      {
        params: {
          cursor: params.cursor,
          size: params.size,
          startDate: params.startDate,
          endDate: params.endDate,
        },
      },
    );

    if (!result.ok) return result;

    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoRepository] Invalid getFriendTodos response: ${parsed.error.message}`,
      );
    }

    return ok({
      todos: toTodoItems(parsed.data.items),
      hasNext: parsed.data.pagination.hasNext,
      nextCursor: parsed.data.pagination.nextCursor,
    });
  }

  async toggleTodoComplete(
    todoId: number,
    body: ToggleTodoCompleteInput,
  ): Promise<Result<TodoItem, ApiError>> {
    const result = await this.#httpClient.patch<{ todo: Todo }>(
      `v1/todos/${todoId}/complete`,
      body,
    );

    if (!result.ok) return result;

    const parsed = todoSchema.safeParse(result.value.todo);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoRepository] Invalid toggleTodoComplete response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data));
  }

  async createTodo(params: CreateTodoInput): Promise<Result<TodoItem, ApiError>> {
    const result = await this.#httpClient.post<{ todo: Todo }>('v1/todos', params);

    if (!result.ok) return result;

    const parsed = todoSchema.safeParse(result.value.todo);
    if (!parsed.success) {
      throw new ParseError(`[TodoRepository] Invalid createTodo response: ${parsed.error.message}`);
    }

    return ok(toTodoItem(parsed.data));
  }

  async parseTodo(text: string): Promise<Result<ParsedTodoResult, ApiError>> {
    const result = await this.#httpClient.post<ParseTodoResponse>('v1/ai/parse-todo', { text });

    if (!result.ok) return result;

    const parsed = parseTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoRepository] Invalid parseTodo response: ${parsed.error.message}`);
    }

    return ok(toParsedTodoResult(parsed.data));
  }

  async getAiUsage(): Promise<Result<AiUsage, ApiError>> {
    const result = await this.#httpClient.get<AiUsageResponse>('v1/ai/usage');

    if (!result.ok) return result;

    const parsed = aiUsageResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoRepository] Invalid getAiUsage response: ${parsed.error.message}`);
    }

    return ok(toAiUsage(parsed.data));
  }

  async getDailyCompletions(
    startDate: string,
    endDate: string,
  ): Promise<Result<DailyCompletionsResult, ApiError>> {
    const result = await this.#httpClient.get<unknown>('v1/daily-completions', {
      params: { startDate, endDate },
    });

    if (!result.ok) return result;

    const parsed = dailyCompletionsRangeResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoRepository] Invalid getDailyCompletions response: ${parsed.error.message}`,
      );
    }

    return ok(toDailyCompletionsResult(parsed.data));
  }
}
