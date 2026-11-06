import {
  type CreateTodoCommentChainInput,
  type GetTodoCommentRepliesQuery,
  type GetTodoCommentThreadsQuery,
  type UpdateTodoCommentInput,
  deleteTodoCommentResponseSchema,
  todoCommentChainResponseSchema,
  todoCommentLikeResponseSchema,
  todoCommentMutationResponseSchema,
  todoCommentRepliesResponseSchema,
  todoCommentThreadsResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { type Result, ok } from '@src/shared/errors/result';

import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
  TodoCommentReplyPage,
  TodoCommentThreadPage,
} from '../domains/todo-comment.model';
import {
  toDeletedCommentId,
  toMutatedComment,
  toTodoCommentChain,
  toTodoCommentLikeResult,
  toTodoCommentReplyPage,
  toTodoCommentThreadPage,
} from './todo-comment.mapper';

/** 읽기는 v2 묶음 API, 쓰기·좋아요는 이전 앱과 같은 v1 API를 쓴다 */
export class TodoCommentService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getThreads = async (
    todoId: number,
    query: GetTodoCommentThreadsQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoCommentThreadPage, ApiError>> => {
    const response = await this.#httpClient.get(`v2/todos/${todoId}/comments`, {
      params: query,
      signal,
    });

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentThreadsResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid threads: ${parsed.error.message}`);
    }

    return ok(toTodoCommentThreadPage(parsed.data));
  };

  getReplies = async (
    todoId: number,
    commentId: string,
    query: GetTodoCommentRepliesQuery,
    signal?: AbortSignal,
  ): Promise<Result<TodoCommentReplyPage, ApiError>> => {
    const response = await this.#httpClient.get(
      `v2/todos/${todoId}/comments/${commentId}/replies`,
      { params: query, signal },
    );

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentRepliesResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid replies: ${parsed.error.message}`);
    }

    return ok(toTodoCommentReplyPage(parsed.data));
  };

  createCommentChain = async (
    todoId: number,
    input: CreateTodoCommentChainInput,
  ): Promise<Result<TodoCommentChain, ApiError>> => {
    const response = await this.#httpClient.post(`v1/todos/${todoId}/comments`, input);

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentChainResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid comment chain: ${parsed.error.message}`);
    }

    return ok(toTodoCommentChain(todoId, parsed.data));
  };

  updateComment = async (
    todoId: number,
    commentId: string,
    input: UpdateTodoCommentInput,
  ): Promise<Result<TodoComment, ApiError>> => {
    const response = await this.#httpClient.patch(
      `v1/todos/${todoId}/comments/${commentId}`,
      input,
    );

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentMutationResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid updated comment: ${parsed.error.message}`);
    }

    return ok(toMutatedComment(todoId, parsed.data));
  };

  deleteComment = async (todoId: number, commentId: string): Promise<Result<string, ApiError>> => {
    const response = await this.#httpClient.delete(`v1/todos/${todoId}/comments/${commentId}`);

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
      ? await this.#httpClient.put(path)
      : await this.#httpClient.delete(path);

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentLikeResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid comment like: ${parsed.error.message}`);
    }

    return ok(toTodoCommentLikeResult(parsed.data));
  };
}
