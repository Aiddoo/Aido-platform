import {
  type ConvertMemoToTodosInput,
  convertMemoToTodosResponseSchema,
  memoDeleteResponseSchema,
  memoDetailResponseSchema,
  memoListResponseSchema,
  memoMutationResponseSchema,
  memoResourceLimitResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

import type { MemoFormValues } from '../domains/memo-form.schema';
import { toMemo, toMemoPage, toMemoRequest, toMemoResourceLimit } from './memo.mapper';

export class MemoService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getMemo = async (memoId: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/memos/${memoId}`, { signal }),
      memoDetailResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoService] Invalid getMemo response',
    );

  getMemos = async (
    { cursor, size }: { cursor: number | null; size: number },
    signal?: AbortSignal,
  ) =>
    parseApiResponse(
      await this.#httpClient.get('v1/memos', {
        signal,
        params: { cursor: cursor ?? undefined, size },
      }),
      memoListResponseSchema,
      toMemoPage,
      '[MemoService] Invalid getMemos response',
    );

  getResourceLimit = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/memos/resource-limit', { signal }),
      memoResourceLimitResponseSchema,
      toMemoResourceLimit,
      '[MemoService] Invalid getResourceLimit response',
    );

  createMemo = async (values: MemoFormValues) =>
    parseApiResponse(
      await this.#httpClient.post('v1/memos', toMemoRequest(values)),
      memoMutationResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoService] Invalid createMemo response',
    );

  updateMemo = async (memoId: number, values: MemoFormValues) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/memos/${memoId}`, toMemoRequest(values)),
      memoMutationResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoService] Invalid updateMemo response',
    );

  togglePin = async (memoId: number, isPinned: boolean) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/memos/${memoId}/pin`, { isPinned }),
      memoMutationResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoService] Invalid togglePin response',
    );

  deleteMemo = async (memoId: number) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/memos/${memoId}`),
      memoDeleteResponseSchema,
      noop,
      '[MemoService] Invalid deleteMemo response',
    );

  convertToTodos = async (memoId: number, input: ConvertMemoToTodosInput) =>
    parseApiResponse(
      await this.#httpClient.post(`v1/memos/${memoId}/convert-to-todos`, input),
      convertMemoToTodosResponseSchema,
      noop,
      '[MemoService] Invalid convertToTodos response',
    );
}
