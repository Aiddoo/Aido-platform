import {
  type CreateTodoCommentChainInput,
  type GetTodoCommentRepliesQuery,
  type GetTodoCommentThreadsQuery,
  type UpdateTodoCommentInput,
  deleteTodoCommentResponseSchema,
  todoCommentLikeResponseSchema,
  todoCommentRepliesResponseSchema,
  todoCommentThreadsResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import {
  writtenTodoCommentChainResponseSchema,
  writtenTodoCommentMutationResponseSchema,
} from '../schemas/todo-comment-response.schema';
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

  getThreads = async (todoId: number, query: GetTodoCommentThreadsQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v2/todos/${todoId}/comments`, { params: query, signal }),
      todoCommentThreadsResponseSchema,
      toTodoCommentThreadPage,
      '[TodoCommentService] Invalid threads',
    );

  getReplies = async (
    todoId: number,
    commentId: string,
    query: GetTodoCommentRepliesQuery,
    signal?: AbortSignal,
  ) =>
    parseApiResponse(
      await this.#httpClient.get(`v2/todos/${todoId}/comments/${commentId}/replies`, {
        params: query,
        signal,
      }),
      todoCommentRepliesResponseSchema,
      toTodoCommentReplyPage,
      '[TodoCommentService] Invalid replies',
    );

  createCommentChain = async (todoId: number, input: CreateTodoCommentChainInput) =>
    parseApiResponse(
      await this.#httpClient.post(`v1/todos/${todoId}/comments`, input),
      writtenTodoCommentChainResponseSchema,
      (dto) => toTodoCommentChain(todoId, dto),
      '[TodoCommentService] Invalid comment chain',
    );

  updateComment = async (todoId: number, commentId: string, input: UpdateTodoCommentInput) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/todos/${todoId}/comments/${commentId}`, input),
      writtenTodoCommentMutationResponseSchema,
      (dto) => toMutatedComment(todoId, dto),
      '[TodoCommentService] Invalid updated comment',
    );

  deleteComment = async (todoId: number, commentId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/todos/${todoId}/comments/${commentId}`),
      deleteTodoCommentResponseSchema,
      toDeletedCommentId,
      '[TodoCommentService] Invalid deleted comment',
    );

  setCommentLike = async (todoId: number, commentId: string, isLiked: boolean) => {
    const path = `v1/todos/${todoId}/comments/${commentId}/likes`;

    return parseApiResponse(
      isLiked ? await this.#httpClient.put(path) : await this.#httpClient.delete(path),
      todoCommentLikeResponseSchema,
      toTodoCommentLikeResult,
      '[TodoCommentService] Invalid comment like',
    );
  };
}
