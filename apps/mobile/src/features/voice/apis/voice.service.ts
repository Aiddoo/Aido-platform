import { applyActionPlanResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import type { VoiceNoteDigestInput } from '../domains/voice-note.model';
import type {
  AppliedPlanResult,
  PlannedAction,
  QuickPlanResult,
  VoiceNoteDigestResult,
  VoicePlanSource,
} from '../domains/voice-plan.model';
import {
  quickPlanEnvelopeSchema,
  toApplyActionPlanRequest,
  toQuickPlanResult,
  toVoiceNoteDigestRequest,
  toVoiceNoteDigestResult,
  voiceNoteDigestEnvelopeSchema,
} from './voice-plan.mapper';

const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
/** 계획 만들기는 AI가 답할 때까지 기다린다. 기본 10초로는 긴 말을 정리하지 못한다 */
const QUICK_PLAN_TIMEOUT_MS = 30_000;
const DIGEST_TIMEOUT_MS = 60_000;

export interface CreateQuickPlanInput {
  text: string;
  source: 'voice' | 'text';
}

export class VoiceService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  createQuickPlan = async (
    { text, source }: CreateQuickPlanInput,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<Result<QuickPlanResult, ApiError>> => {
    const result = await this.#httpClient.post(
      'v1/quick-plans',
      { text, source: source === 'voice' ? 'VOICE' : 'TEXT' },
      {
        headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        timeout: QUICK_PLAN_TIMEOUT_MS,
        signal,
      },
    );
    if (!result.ok) {
      return result;
    }

    return ok(
      this.#map('createQuickPlan', () =>
        toQuickPlanResult(quickPlanEnvelopeSchema.parse(result.value), {
          planId: idempotencyKey,
          source: source === 'voice' ? 'quick-voice' : 'quick-text',
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
        toVoiceNoteDigestResult(voiceNoteDigestEnvelopeSchema.parse(result.value), idempotencyKey),
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
    const result = await this.#httpClient.post(
      'v1/action-plans/apply',
      toApplyActionPlanRequest(source, actions, fallbackCategoryId, sourceMemoId),
      { headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey } },
    );
    if (!result.ok) {
      return result;
    }

    const parsed = applyActionPlanResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[VoiceService] Invalid applyActionPlan response: ${parsed.error.message}`,
      );
    }
    return ok({ todoCount: parsed.data.todos.length, hasMemo: parsed.data.memo != null });
  };

  /** 제목·내용은 로그에 남기지 않는다. 어느 칸이 계약과 다른지만 남긴다 */
  #map<T>(method: string, map: () => T): T {
    try {
      return map();
    } catch (error) {
      const zodError = error instanceof Error ? error.message : undefined;
      this.#logger.error(VOICE_LOG_EVENT.PLAN_MAPPING_FAILED, undefined, { method, zodError });
      throw new ParseError(`[VoiceService] Invalid ${method} response: ${zodError}`);
    }
  }
}
