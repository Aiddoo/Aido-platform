import { applyActionPlanResponseSchema } from '@aido/api';
import { IDEMPOTENCY_KEY_HEADER } from '@aido/api/vocabulary';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import type { Logger } from '@src/core/ports/logger';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { ParseError } from '@src/shared/errors/infra-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import type { VoiceNoteDigestInput } from '../domains/voice-note.model';
import type {
  AppliedPlanResult,
  PlannedAction,
  QuickPlanResult,
  VoiceNoteDigestResult,
  VoicePlanSource,
} from '../domains/voice-plan.model';
import type { CreateQuickPlanInput } from '../schemas/quick-plan-request.schema';
import {
  lenientQuickPlanResponseSchema,
  lenientVoiceNoteDigestResponseSchema,
} from '../schemas/voice-plan-response.schema';
import {
  toAppliedPlanResult,
  toApplyActionPlanRequest,
  toQuickPlanRequest,
  toQuickPlanResult,
  toVoiceNoteDigestRequest,
  toVoiceNoteDigestResult,
} from './voice-plan.mapper';

// 서버 AI 제한(빠른 계획 24초, 노트 정리 45초)보다 길어야 앱이 먼저 끊지 않고 환불된 오류(charged:false)를 받는다
const QUICK_PLAN_TIMEOUT_MS = 30_000;
const DIGEST_TIMEOUT_MS = MINUTE_MS;

export class VoiceApi {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  createQuickPlan = async (
    input: CreateQuickPlanInput,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<Result<QuickPlanResult, ApiError>> => {
    const result = await this.#httpClient.post('v1/quick-plans', toQuickPlanRequest(input), {
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      timeout: QUICK_PLAN_TIMEOUT_MS,
      signal,
    });
    if (!result.ok) {
      return result;
    }

    return ok(
      this.#map('createQuickPlan', () =>
        toQuickPlanResult(lenientQuickPlanResponseSchema.parse(result.value), {
          planId: idempotencyKey,
          source: input.source,
        }),
      ),
    );
  };

  createVoiceNoteDigest = async (
    input: VoiceNoteDigestInput,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<Result<VoiceNoteDigestResult, ApiError>> => {
    const result = await this.#httpClient.post(
      'v1/voice-notes/digest',
      toVoiceNoteDigestRequest(input),
      {
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        timeout: DIGEST_TIMEOUT_MS,
        signal,
      },
    );
    if (!result.ok) {
      return result;
    }

    return ok(
      this.#map('createVoiceNoteDigest', () =>
        toVoiceNoteDigestResult(
          lenientVoiceNoteDigestResponseSchema.parse(result.value),
          idempotencyKey,
        ),
      ),
    );
  };

  /** 사용자가 확인한 행동만 저장한다. 차감 없음. 반복은 첫 회차만 돌려받고 목록을 다시 읽어 본다 */
  applyActionPlan = async (
    {
      source,
      sourceMemoId,
      actions,
      fallbackCategoryId,
    }: {
      source: VoicePlanSource;
      sourceMemoId: number | null;
      actions: readonly PlannedAction[];
      fallbackCategoryId: number;
    },
    idempotencyKey: string,
  ): Promise<Result<AppliedPlanResult, ApiError>> => {
    return parseApiResponse(
      await this.#httpClient.post(
        'v1/action-plans/apply',
        toApplyActionPlanRequest({ source, actions, fallbackCategoryId, sourceMemoId }),
        { headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey } },
      ),
      applyActionPlanResponseSchema,
      toAppliedPlanResult,
      '[VoiceApi] Invalid applyActionPlan response',
    );
  };

  /** 제목·내용은 로그에 남기지 않는다. 어느 칸이 계약과 다른지만 남긴다 */
  #map = <T>(method: string, map: () => T): T => {
    try {
      return map();
    } catch (error) {
      const zodError = error instanceof Error ? error.message : undefined;
      this.#logger.error(VOICE_LOG_EVENT.PLAN_MAPPING_FAILED, undefined, { method, zodError });
      throw new ParseError(`[VoiceApi] Invalid ${method} response: ${zodError}`);
    }
  };
}
