import {
  type CreateTodoItemInput,
  type ReorderTodoItemsInput,
  type Todo,
  todoSchema,
  type UpdateTodoItemInput,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { TodoItem } from '../models/todo.model';
import { toTodoItem } from './todo.mapper';

export class SubTodoService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  addSubTodo = async (
    todoId: number,
    body: CreateTodoItemInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.post<{ message: string; todo: Todo }>(
      `v1/todos/${todoId}/items`,
      body,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = todoSchema.safeParse(result.value.todo);
    if (!parsed.success) {
      throw new ParseError(`[SubTodoService] Invalid addSubTodo response: ${parsed.error.message}`);
    }

    return ok(toTodoItem(parsed.data));
  };

  updateSubTodo = async (
    todoId: number,
    subTodoId: number,
    body: UpdateTodoItemInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch<{ message: string; todo: Todo }>(
      `v1/todos/${todoId}/items/${subTodoId}`,
      body,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = todoSchema.safeParse(result.value.todo);
    if (!parsed.success) {
      throw new ParseError(
        `[SubTodoService] Invalid updateSubTodo response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data));
  };

  deleteSubTodo = async (
    todoId: number,
    subTodoId: number,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.delete<{ message: string; todo: Todo }>(
      `v1/todos/${todoId}/items/${subTodoId}`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = todoSchema.safeParse(result.value.todo);
    if (!parsed.success) {
      throw new ParseError(
        `[SubTodoService] Invalid deleteSubTodo response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data));
  };

  reorderSubTodos = async (
    todoId: number,
    body: ReorderTodoItemsInput,
  ): Promise<Result<TodoItem, ApiError>> => {
    const result = await this.#httpClient.patch<{ message: string; todo: Todo }>(
      `v1/todos/${todoId}/items/reorder`,
      body,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = todoSchema.safeParse(result.value.todo);
    if (!parsed.success) {
      throw new ParseError(
        `[SubTodoService] Invalid reorderSubTodos response: ${parsed.error.message}`,
      );
    }

    return ok(toTodoItem(parsed.data));
  };
}
