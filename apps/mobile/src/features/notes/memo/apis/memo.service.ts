import {
  convertMemoToTodosResponseSchema,
  memoDeleteResponseSchema,
  memoDetailResponseSchema,
  memoListResponseSchema,
  memoMutationResponseSchema,
  memoResourceLimitResponseSchema,
  parseMemoResponseSchema,
} from '@aido/api';
import { IDEMPOTENCY_KEY_HEADER } from '@aido/api/vocabulary';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import { toFeatureQuota } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { MEMO_LOG_EVENT } from '@src/features/notes/memo/constants/memo-log-events';
import type { AddTodoFormValues } from '@src/features/planning/composer/domains/add-todo-form.schema';
import { toVoicePlanFromParsedMemo } from '@src/features/voice/apis/voice-plan.mapper';
import { VOICE_LOG_EVENT } from '@src/features/voice/constants/voice-log-events';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { ok, type Result } from '@src/shared/errors/result';
import { noop } from 'es-toolkit';

import type { ParsedMemoPlan } from '../domains/memo.model';
import type { MemoFormValues } from '../schemas/memo-form.schema';
import {
  toConvertMemoToTodosRequest,
  toMemo,
  toMemoPage,
  toMemoRequest,
  toMemoResourceLimit,
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

  convertToTodos = async (memoId: number, values: AddTodoFormValues) =>
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
  ): Promise<Result<ParsedMemoPlan, ApiError>> => {
    const result = await this.#httpClient.post(
      'v1/ai/parse-memo',
      { content, categoryId },
      { headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey }, timeout: PARSE_MEMO_TIMEOUT_MS },
    );

    if (!result.ok) {
      return result;
    }

    const parsed = parseMemoResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(MEMO_LOG_EVENT.RESPONSE_PARSE_FAILED, undefined, {
        method: 'parseMemo',
        zodError: parsed.error.message,
      });
      throw new ParseError(`[MemoService] Invalid parseMemo response: ${parsed.error.message}`);
    }

    try {
      return ok({
        plan: toVoicePlanFromParsedMemo(idempotencyKey, parsed.data),
        featureQuota:
          parsed.data.featureQuota == null ? null : toFeatureQuota(parsed.data.featureQuota),
      });
    } catch (error) {
      this.#logger.error(VOICE_LOG_EVENT.PLAN_MAPPING_FAILED, undefined, {
        method: 'parseMemo',
        zodError: error instanceof Error ? error.message : undefined,
      });
      throw new ParseError('[MemoService] Invalid parseMemo plan');
    }
  };
}
