import {
  convertMemoToTodosResponseSchema,
  memoDeleteResponseSchema,
  memoDetailResponseSchema,
  memoListResponseSchema,
  memoMutationResponseSchema,
  memoResourceLimitResponseSchema,
} from '@aido/api';
import { IDEMPOTENCY_KEY_HEADER } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import { toFeatureQuota } from '@src/features/billing/subscription/apis/entitlement.mapper';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { ParseError } from '@src/shared/errors/infra-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

import { MEMO_LOG_EVENT } from '../constants/memo-log-events';
import type { MemoFormValues } from '../schemas/memo-form.schema';
import {
  type ParsedMemoPlan,
  parseMemoPlanResponseSchema,
} from '../schemas/memo-plan-response.schema';
import {
  toConvertMemoToTodosRequest,
  toMemo,
  toMemoPage,
  toMemoRequest,
  toMemoResourceLimit,
  toMemoVoicePlan,
} from './memo.mapper';

// 서버 업체 체인 제한(AI_DEADLINE_PARSE_MEMO_MS 25초)보다 길게 기다려야 앱이 먼저 끊어 차감된 결과를 잃지 않는다
const PARSE_MEMO_TIMEOUT_MS = 30_000;

export class MemoService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getMemo = async (memoId: number, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get(`v1/memos/${memoId}`, { signal }),
      memoDetailResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoService] Invalid getMemo response',
    );

  getMemos = async (
    { cursor, size }: { cursor: number | undefined; size: number },
    signal?: AbortSignal,
  ) =>
    parseApiResponse(
      await this.#httpClient.get('v1/memos', {
        signal,
        params: { cursor, size },
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

  createMemo = async (values: MemoFormValues, idempotencyKey: string) =>
    parseApiResponse(
      await this.#httpClient.post('v1/memos', toMemoRequest(values), {
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      }),
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

  setPinned = async (memoId: number, isPinned: boolean) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/memos/${memoId}/pin`, { isPinned }),
      memoMutationResponseSchema,
      ({ memo }) => toMemo(memo),
      '[MemoService] Invalid setPinned response',
    );

  deleteMemo = async (memoId: number) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/memos/${memoId}`),
      memoDeleteResponseSchema,
      noop,
      '[MemoService] Invalid deleteMemo response',
    );

  convertToTodos = async (memoId: number, values: TodoFormValues) =>
    parseApiResponse(
      await this.#httpClient.post(
        `v1/memos/${memoId}/convert-to-todos`,
        toConvertMemoToTodosRequest(values),
      ),
      convertMemoToTodosResponseSchema,
      noop,
      '[MemoService] Invalid convertToTodos response',
    );

  parseMemo = async (
    content: string,
    categoryId: number,
    idempotencyKey: string,
  ): Promise<Result<ParsedMemoPlan, ApiError>> =>
    parseApiResponse(
      await this.#httpClient.post(
        'v1/ai/parse-memo',
        { content, categoryId },
        { headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }, timeout: PARSE_MEMO_TIMEOUT_MS },
      ),
      parseMemoPlanResponseSchema,
      (dto) => {
        try {
          return {
            plan: toMemoVoicePlan(idempotencyKey, dto),
            featureQuota: dto.featureQuota == null ? null : toFeatureQuota(dto.featureQuota),
          };
        } catch (error) {
          this.#logger.error(MEMO_LOG_EVENT.PLAN_MAPPING_FAILED, undefined, {
            method: 'parseMemo',
            zodError: error instanceof Error ? error.message : undefined,
          });
          throw new ParseError('[MemoService] Invalid parseMemo plan');
        }
      },
      '[MemoService] Invalid parseMemo response',
      (zodError) =>
        this.#logger.error(MEMO_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
          method: 'parseMemo',
          zodError,
        }),
    );
}
