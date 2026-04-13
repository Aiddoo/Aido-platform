import {
  type ConvertMemoToTodoInput,
  type ConvertMemoToTodoResponse,
  type ConvertMemoToTodosInput,
  type ConvertMemoToTodosResponse,
  type CreateMemoInput,
  convertMemoToTodoResponseSchema,
  convertMemoToTodosResponseSchema,
  type GetMemosQuery,
  type MemoDeleteResponse,
  type MemoDetailResponse,
  type MemoListResponse,
  type MemoMutationResponse,
  type MemoResourceLimitResponse,
  memoDeleteResponseSchema,
  memoDetailResponseSchema,
  memoListResponseSchema,
  memoMutationResponseSchema,
  memoResourceLimitResponseSchema,
  type ReorderMemoInput,
  type ToggleMemoPinInput,
  type UpdateMemoInput,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { MemoItem, MemoPage, MemoResourceLimit } from '../models/memo.model';
import { toMemoItem, toMemoPage, toMemoResourceLimit } from './memo.mapper';

export class MemoService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getResourceLimit = async (): Promise<Result<MemoResourceLimit, ApiError>> => {
    const result = await this.#httpClient.get<MemoResourceLimitResponse>('v1/memos/resource-limit');
    if (!result.ok) {
      return result;
    }

    const parsed = memoResourceLimitResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[MemoService] Invalid getResourceLimit response: ${parsed.error.message}`,
      );
    }

    return ok(toMemoResourceLimit(parsed.data));
  };

  getMemo = async (id: number): Promise<Result<MemoItem, ApiError>> => {
    const result = await this.#httpClient.get<MemoDetailResponse>(`v1/memos/${id}`);
    if (!result.ok) {
      return result;
    }

    const parsed = memoDetailResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid getMemo response: ${parsed.error.message}`);
    }

    return ok(toMemoItem(parsed.data.memo));
  };

  getMemos = async (params?: GetMemosQuery): Promise<Result<MemoPage, ApiError>> => {
    const result = await this.#httpClient.get<MemoListResponse>('v1/memos', {
      params: {
        cursor: params?.cursor,
        size: params?.size,
      },
    });
    if (!result.ok) {
      return result;
    }

    const parsed = memoListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid getMemos response: ${parsed.error.message}`);
    }

    return ok(toMemoPage(parsed.data));
  };

  createMemo = async (input: CreateMemoInput): Promise<Result<MemoItem, ApiError>> => {
    const result = await this.#httpClient.post<MemoMutationResponse>('v1/memos', input);
    if (!result.ok) {
      return result;
    }

    const parsed = memoMutationResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid createMemo response: ${parsed.error.message}`);
    }

    return ok(toMemoItem(parsed.data.memo));
  };

  updateMemo = async (id: number, input: UpdateMemoInput): Promise<Result<MemoItem, ApiError>> => {
    const result = await this.#httpClient.patch<MemoMutationResponse>(`v1/memos/${id}`, input);
    if (!result.ok) {
      return result;
    }

    const parsed = memoMutationResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid updateMemo response: ${parsed.error.message}`);
    }

    return ok(toMemoItem(parsed.data.memo));
  };

  togglePin = async (
    id: number,
    input: ToggleMemoPinInput,
  ): Promise<Result<MemoItem, ApiError>> => {
    const result = await this.#httpClient.patch<MemoMutationResponse>(`v1/memos/${id}/pin`, input);
    if (!result.ok) {
      return result;
    }

    const parsed = memoMutationResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid togglePin response: ${parsed.error.message}`);
    }

    return ok(toMemoItem(parsed.data.memo));
  };

  reorder = async (id: number, input: ReorderMemoInput): Promise<Result<MemoItem, ApiError>> => {
    const result = await this.#httpClient.patch<MemoMutationResponse>(
      `v1/memos/${id}/reorder`,
      input,
    );
    if (!result.ok) {
      return result;
    }

    const parsed = memoMutationResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid reorder response: ${parsed.error.message}`);
    }

    return ok(toMemoItem(parsed.data.memo));
  };

  deleteMemo = async (id: number): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.delete<MemoDeleteResponse>(`v1/memos/${id}`);
    if (!result.ok) {
      return result;
    }

    const parsed = memoDeleteResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid deleteMemo response: ${parsed.error.message}`);
    }

    return ok(undefined);
  };

  convertToTodo = async (
    id: number,
    input: ConvertMemoToTodoInput,
  ): Promise<Result<ConvertMemoToTodoResponse, ApiError>> => {
    const result = await this.#httpClient.post<ConvertMemoToTodoResponse>(
      `v1/memos/${id}/convert-to-todo`,
      input,
    );
    if (!result.ok) {
      return result;
    }

    const parsed = convertMemoToTodoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[MemoService] Invalid convertToTodo response: ${parsed.error.message}`);
    }

    return ok(parsed.data);
  };

  convertToTodos = async (
    id: number,
    input: ConvertMemoToTodosInput,
  ): Promise<Result<ConvertMemoToTodosResponse, ApiError>> => {
    const result = await this.#httpClient.post<ConvertMemoToTodosResponse>(
      `v1/memos/${id}/convert-to-todos`,
      input,
    );
    if (!result.ok) {
      return result;
    }

    const parsed = convertMemoToTodosResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[MemoService] Invalid convertToTodos response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data);
  };
}
