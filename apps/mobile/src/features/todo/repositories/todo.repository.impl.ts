import {
  type AiUsageResponse,
  aiUsageResponseSchema,
  type CreateTodoInput,
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

import type { AiUsage, ParsedTodoResult, TodoItem, TodosResult } from '../models/todo.model';
import { toAiUsage, toParsedTodoResult, toTodoItem, toTodoItems } from './todo.mapper';
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
        startDate: params.startDate,
        endDate: params.endDate,
      },
    });

    if (!result.ok) return result;

    const parsed = todoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoRepository] Invalid getTodos response:', parsed.error);
      throw new ParseError();
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
      console.error('[TodoRepository] Invalid toggleTodoComplete response:', parsed.error);
      throw new ParseError();
    }

    return ok(toTodoItem(parsed.data));
  }

  async createTodo(params: CreateTodoInput): Promise<Result<TodoItem, ApiError>> {
    const result = await this.#httpClient.post<{ todo: Todo }>('v1/todos', params);

    if (!result.ok) return result;

    const parsed = todoSchema.safeParse(result.value.todo);
    if (!parsed.success) {
      console.error('[TodoRepository] Invalid createTodo response:', parsed.error);
      throw new ParseError();
    }

    return ok(toTodoItem(parsed.data));
  }

  async parseTodo(text: string): Promise<Result<ParsedTodoResult, ApiError>> {
    const result = await this.#httpClient.post<ParseTodoResponse>('v1/ai/parse-todo', { text });

    if (!result.ok) return result;

    const parsed = parseTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoRepository] Invalid parseTodo response:', parsed.error);
      throw new ParseError();
    }

    return ok(toParsedTodoResult(parsed.data));
  }

  async getAiUsage(): Promise<Result<AiUsage, ApiError>> {
    const result = await this.#httpClient.get<AiUsageResponse>('v1/ai/usage');

    if (!result.ok) return result;

    const parsed = aiUsageResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[TodoRepository] Invalid getAiUsage response:', parsed.error);
      throw new ParseError();
    }

    return ok(toAiUsage(parsed.data));
  }
}
