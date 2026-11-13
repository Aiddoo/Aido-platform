import {
  type CreateTodoItemInput,
  type ReorderTodoItemsInput,
  type UpdateTodoItemInput,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { Todo } from '../domains/todo.model';
import { updateTodoEnvelopeSchema } from '../schemas/todo-response.schema';
import { toTodo } from './todo.mapper';

export class SubTodoApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  addSubTodo = async (
    todoId: number,
    body: CreateTodoItemInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.post(`v1/todos/${todoId}/items`, body);

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[SubTodoApi] Invalid addSubTodo response',
    );
  };

  updateSubTodo = async (
    todoId: number,
    subTodoId: number,
    body: UpdateTodoItemInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/items/${subTodoId}`, body);

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[SubTodoApi] Invalid updateSubTodo response',
    );
  };

  deleteSubTodo = async (todoId: number, subTodoId: number): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.delete(`v1/todos/${todoId}/items/${subTodoId}`);

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[SubTodoApi] Invalid deleteSubTodo response',
    );
  };

  reorderSubTodos = async (
    todoId: number,
    body: ReorderTodoItemsInput,
  ): Promise<Result<Todo, ApiError>> => {
    const result = await this.#httpClient.patch(`v1/todos/${todoId}/items/reorder`, body);

    return parseApiResponse(
      result,
      updateTodoEnvelopeSchema,
      (data) => toTodo(data.todo),
      '[SubTodoApi] Invalid reorderSubTodos response',
    );
  };
}
