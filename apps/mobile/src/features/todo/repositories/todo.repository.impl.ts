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
import { TodoClientError } from '../models/todo.error';

import type { TodoRepository } from './todo.repository';

export class TodoRepositoryImpl implements TodoRepository {
  constructor(private readonly _httpClient: HttpClient) {}

  private _buildUrl(
    basePath: string,
    params: Record<string, string | number | boolean | undefined>,
  ): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  async getTodos(params: GetTodosQuery): Promise<TodoListResponse> {
    const url = this._buildUrl('v1/todos', {
      cursor: params.cursor,
      size: params.size,
      completed: params.completed,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const { data } = await this._httpClient.get<TodoListResponse>(url);

    const result = todoListResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[TodoRepository] Invalid getTodos response:', result.error);
      throw TodoClientError.validation();
    }

    return result.data;
  }

  async toggleTodoComplete(todoId: number, body: ToggleTodoCompleteInput): Promise<Todo> {
    const { data } = await this._httpClient.patch<{ todo: Todo }>(
      `v1/todos/${todoId}/complete`,
      body,
    );

    const result = todoSchema.safeParse(data.todo);
    if (!result.success) {
      console.error('[TodoRepository] Invalid toggleTodoComplete response:', result.error);
      throw TodoClientError.validation();
    }

    return result.data;
  }

  async createTodo(params: CreateTodoInput): Promise<Todo> {
    const { data } = await this._httpClient.post<{ todo: Todo }>('v1/todos', params);

    const result = todoSchema.safeParse(data.todo);
    if (!result.success) {
      console.error('[TodoRepository] Invalid createTodo response:', result.error);
      throw TodoClientError.validation();
    }

    return result.data;
  }

  async parseTodo(text: string): Promise<ParseTodoResponse> {
    const { data } = await this._httpClient.post<ParseTodoResponse>('v1/ai/parse-todo', { text });

    const result = parseTodoResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[TodoRepository] Invalid parseTodo response:', result.error);
      throw TodoClientError.validation();
    }

    return result.data;
  }

  async getAiUsage(): Promise<AiUsageResponse> {
    const { data } = await this._httpClient.get<AiUsageResponse>('v1/ai/usage');

    const result = aiUsageResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[TodoRepository] Invalid getAiUsage response:', result.error);
      throw TodoClientError.validation();
    }

    return result.data;
  }
}
