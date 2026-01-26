import {
  type Todo,
  type TodoListResponse,
  todoListResponseSchema,
  todoSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';

import { TodoError } from '../models/todo.error';
import type {
  GetTodoCountsParams,
  GetTodosParams,
  TodoCountsResponse,
  TodoRepository,
  ToggleTodoCompleteParams,
} from './todo.repository';

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

  async getTodos(params: GetTodosParams): Promise<TodoListResponse> {
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
      throw TodoError.invalidResponse();
    }

    return result.data;
  }

  async getTodoCounts(params: GetTodoCountsParams): Promise<TodoCountsResponse> {
    const url = this._buildUrl('v1/todos/counts', {
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const { data } = await this._httpClient.get<TodoCountsResponse>(url);

    return data;
  }

  async toggleTodoComplete(params: ToggleTodoCompleteParams): Promise<Todo> {
    const { data } = await this._httpClient.patch<Todo>(`v1/todos/${params.todoId}/complete`, {
      completed: params.completed,
    });

    const result = todoSchema.safeParse(data);
    if (!result.success) {
      console.error('[TodoRepository] Invalid toggleTodoComplete response:', result.error);
      throw TodoError.invalidResponse();
    }

    return result.data;
  }
}
