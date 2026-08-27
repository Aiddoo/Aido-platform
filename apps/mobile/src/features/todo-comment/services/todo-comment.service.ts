import {
  type CreateTodoCommentChainInput,
  type GetTodoCommentOverviewQuery,
  type GetTodoConversationQuery,
  type UpdateTodoCommentInput,
  deleteTodoCommentResponseSchema,
  todoCommentChainResponseSchema,
  todoCommentLikeResponseSchema,
  todoCommentMutationResponseSchema,
  todoCommentOverviewResponseSchema,
  todoConversationResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { type Result, ok } from '@src/shared/errors/result';

import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
  TodoCommentOverviewPage,
  TodoConversationPage,
} from '../models/todo-comment.model';
import {
  toDeletedCommentId,
  toMutatedComment,
  toTodoCommentChain,
  toTodoCommentLikeResult,
  toTodoCommentOverviewPage,
  toTodoConversationPage,
} from './todo-comment.mapper';

export class TodoCommentService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getOverview = async (
    todoId: number,
    query: GetTodoCommentOverviewQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoCommentOverviewPage, ApiError>> => {
    const response = await this.#httpClient.get<unknown>(`v1/todos/${todoId}/comments/overview`, {
      params: query,
      signal,
    });

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentOverviewResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid overview: ${parsed.error.message}`);
    }

    return ok(toTodoCommentOverviewPage(parsed.data));
  };

  getConversation = async (
    todoId: number,
    query: GetTodoConversationQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoConversationPage, ApiError>> => {
    const response = await this.#httpClient.get<unknown>(`v1/todos/${todoId}/conversation`, {
      params: query,
      signal,
    });

    if (!response.ok) {
      return response;
    }

    const parsed = todoConversationResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid conversation: ${parsed.error.message}`);
    }

    return ok(toTodoConversationPage(parsed.data));
  };

  writeComments = async (
    todoId: number,
    input: CreateTodoCommentChainInput,
  ): Promise<Result<TodoCommentChain, ApiError>> => {
    const response = await this.#httpClient.post<unknown>(`v1/todos/${todoId}/comments`, input);

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentChainResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid comment chain: ${parsed.error.message}`);
    }

    return ok(toTodoCommentChain(parsed.data));
  };

  updateComment = async (
    todoId: number,
    commentId: string,
    input: UpdateTodoCommentInput,
  ): Promise<Result<TodoComment, ApiError>> => {
    const response = await this.#httpClient.patch<unknown>(
      `v1/todos/${todoId}/comments/${commentId}`,
      input,
    );

    return this.#toMutatedComment(response, 'updateComment');
  };

  deleteComment = async (todoId: number, commentId: string): Promise<Result<string, ApiError>> => {
    const response = await this.#httpClient.delete<unknown>(
      `v1/todos/${todoId}/comments/${commentId}`,
    );

    if (!response.ok) {
      return response;
    }

    const parsed = deleteTodoCommentResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid deleted comment: ${parsed.error.message}`);
    }

    return ok(toDeletedCommentId(parsed.data));
  };

  setCommentLike = async (
    todoId: number,
    commentId: string,
    isLiked: boolean,
  ): Promise<Result<TodoCommentLikeResult, ApiError>> => {
    const path = `v1/todos/${todoId}/comments/${commentId}/likes`;
    const response = isLiked
      ? await this.#httpClient.put<unknown>(path)
      : await this.#httpClient.delete<unknown>(path);

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentLikeResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid comment like: ${parsed.error.message}`);
    }

    return ok(toTodoCommentLikeResult(parsed.data));
  };

  #toMutatedComment = (
    response: Result<unknown, ApiError>,
    operation: string,
  ): Result<TodoComment, ApiError> => {
    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentMutationResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(
        `[TodoCommentService] Invalid ${operation} response: ${parsed.error.message}`,
      );
    }

    return ok(toMutatedComment(parsed.data));
  };
}
