import {
  type CreateTodoCommentChainInput,
  type GetTodoCommentsQuery,
  type UpdateTodoCommentInput,
  deleteTodoCommentResponseSchema,
  paginatedTodoCommentsSchema,
  todoCommentChainResponseSchema,
  todoCommentLikeResponseSchema,
  todoCommentMutationResponseSchema,
  todoCommentThreadResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { type Result, ok } from '@src/shared/errors/result';

import type {
  TodoComment,
  TodoCommentChain,
  TodoCommentLikeResult,
  TodoCommentPage,
  TodoCommentThread,
} from '../models/todo-comment.model';
import {
  toDeletedCommentId,
  toMutatedComment,
  toTodoCommentChain,
  toTodoCommentLikeResult,
  toTodoCommentPage,
  toTodoCommentThread,
} from './todo-comment.mapper';

/** 부모가 없으면 할 일에 바로 달리고, 있으면 그 댓글의 답글이 된다. */
const commentsPath = (todoId: number, parentId: string | null) =>
  parentId === null
    ? `v1/todos/${todoId}/comments`
    : `v1/todos/${todoId}/comments/${parentId}/replies`;

/** 댓글 HTTP 경계. 호출 + Zod 검증 + 도메인 변환까지가 이 레이어의 책임이다. */
export class TodoCommentService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  /** parentId가 없으면 최상위 댓글, 있으면 그 댓글의 직계 답글. 응답 모양은 같다. */
  getComments = async (
    todoId: number,
    parentId: string | null,
    query: GetTodoCommentsQuery,
  ): Promise<Result<TodoCommentPage, ApiError>> => {
    const response = await this.#httpClient.get<unknown>(commentsPath(todoId, parentId), {
      params: query,
    });

    if (!response.ok) {
      return response;
    }

    const parsed = paginatedTodoCommentsSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid comments: ${parsed.error.message}`);
    }

    return ok(toTodoCommentPage(parsed.data));
  };

  /** 스레드 머리말 — 조상 사슬과 지금 보는 댓글. 정렬과 무관해 한 번 받으면 오래 산다. */
  getThread = async (
    todoId: number,
    commentId: string,
  ): Promise<Result<TodoCommentThread, ApiError>> => {
    const response = await this.#httpClient.get<unknown>(
      `v1/todos/${todoId}/comments/${commentId}/thread`,
    );

    if (!response.ok) {
      return response;
    }

    const parsed = todoCommentThreadResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      throw new ParseError(`[TodoCommentService] Invalid comment thread: ${parsed.error.message}`);
    }

    return ok(toTodoCommentThread(parsed.data));
  };

  /** 하나든 여럿이든 같은 계약으로 보낸다 — 여러 개면 앞 글의 답글로 이어진다. */
  writeComments = async (
    todoId: number,
    parentId: string | null,
    input: CreateTodoCommentChainInput,
  ): Promise<Result<TodoCommentChain, ApiError>> => {
    const response = await this.#httpClient.post<unknown>(commentsPath(todoId, parentId), input);

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

  /** 작성·수정이 같은 응답 계약을 쓰므로 검증과 변환도 한 곳에 둔다. */
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
