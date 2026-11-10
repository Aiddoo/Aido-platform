import type { VoiceNoteDigestResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { omit } from "es-toolkit";

import type { QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import {
  fingerprintRequest,
  resolveRequestLocale,
  type ChargedGeneration,
  type ChargeOutcome,
  type UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import type {
  ActionPlanGeneratorPort,
  VoiceNoteDigestGeneration,
} from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import type { PlanResultReplayPort } from "../../../action-plans/application/ports/plan-result-replay.port.js";
import type { PlanningContextReaderPort } from "../../../action-plans/application/ports/planning-context.reader.port.js";
import {
  countPlannedActions,
  toActionPlanView,
} from "../../../action-plans/application/read-models/action-plan.read-model.js";
import { VoiceLogEvent } from "../../../action-plans/application/voice.log-events.js";
import type { ChargedPlanRunner } from "../../../action-plans/infrastructure/adapters/quota-charged-plan-runner.adapter.js";
import { type TranscriptSegment, VoiceTranscript } from "../../domain/voice-transcript.vo.js";

/** `model`은 다시 보낸 응답의 로그에도 남기려고 함께 보관하고, 응답에는 싣지 않는다. */
export type VoiceNoteDigestResult = Omit<VoiceNoteDigestResponse, "featureQuota" | "charged"> & {
  readonly model: string;
};

export interface DigestVoiceNoteInput {
  readonly userId: string;
  readonly text: string;
  readonly durationSeconds: number;
  readonly segments: readonly TranscriptSegment[];
  readonly idempotencyKey: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  readonly timezone: string | undefined;
  /** Accept-Language 헤더. 없으면 저장된 사용자 언어를 쓴다. */
  readonly locale: SupportedLocale | undefined;
  /** 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다. */
  readonly signal?: AbortSignal;
}

interface DigestVoiceNoteDependencies {
  readonly runner: Pick<ChargedPlanRunner, "run">;
  readonly quota: Pick<QuotaLedgerPort, "read">;
  readonly generator: Pick<ActionPlanGeneratorPort, "digestVoiceNote">;
  readonly contextReader: Pick<PlanningContextReaderPort, "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly replay: PlanResultReplayPort<VoiceNoteDigestResult>;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 요약·핵심 내용도 결과이므로 할 일이 0개여도 횟수를 쓴다. 돌려줄 내용이 전혀 없을 때만 환불한다. */
function resolveChargeOutcome(digest: VoiceNoteDigestGeneration): ChargeOutcome {
  return digest.isEmpty ? "EMPTY" : "CHARGE";
}

/** 긴 전사 → 제목·요약·핵심 내용·실행 계획. 전사 글자는 요청이 끝나면 어디에도 남지 않는다. */
export class DigestVoiceNote {
  readonly #dependencies: DigestVoiceNoteDependencies;

  constructor(dependencies: DigestVoiceNoteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DigestVoiceNoteInput): Promise<VoiceNoteDigestResponse> {
    const { userId, text, durationSeconds, segments, idempotencyKey } = input;
    const startedAt = Date.now();
    const transcript = VoiceTranscript.create({ text, durationSeconds, segments });
    const logFields = {
      userId,
      characterCount: transcript.characterCount,
      segmentCount: segments.length,
      durationSeconds,
    };
    try {
      await this.#assertWithinPerUseLimit(userId, transcript);
      const { timezone, locale } = await resolveRequestLocale(
        this.#dependencies.localePreferenceReader,
        userId,
        input,
      );
      const { result, charged, featureQuota } =
        await this.#dependencies.runner.run<VoiceNoteDigestResult>({
          userId,
          feature: "VOICE_NOTE",
          reason: "voice-note-digest",
          idempotencyKey,
          requestHash: fingerprintRequest(userId, { text, durationSeconds, segments }),
          replay: this.#dependencies.replay,
          generate: () =>
            this.#generate(transcript, {
              userId,
              timezone,
              locale,
              signal: input.signal,
            }),
        });
      this.#dependencies.logger.log({
        event: VoiceLogEvent.NOTE_DIGEST_COMPLETED,
        ...logFields,
        ...countPlannedActions(result.plan),
        keyPointCount: result.keyPoints.length,
        model: result.model,
        latencyMs: Date.now() - startedAt,
        quotaCharged: charged,
      });
      return { ...omit(result, ["model"]), featureQuota, charged };
    } catch (error) {
      this.#dependencies.logger.warn({
        event: VoiceLogEvent.NOTE_DIGEST_FAILED,
        ...logFields,
        latencyMs: Date.now() - startedAt,
        ...(error instanceof ErrorCodedException
          ? { errorCode: error.errorCode }
          : { errorType: toErrorType(error) }),
      });
      throw error;
    }
  }

  /** 등급별 상한은 access가 계산해 준 값만 쓴다. 차감 전에 막아 횟수를 쓰지 않는다. */
  async #assertWithinPerUseLimit(userId: string, transcript: VoiceTranscript): Promise<void> {
    const featureQuota = await this.#dependencies.quota.read(userId, "VOICE_NOTE");
    if (featureQuota.perUse != null && transcript.exceeds(featureQuota.perUse)) {
      throw new ApplicationException(ErrorCode.AI_1312, {
        charged: false,
        featureQuota,
        characterCount: transcript.characterCount,
        maxCharacters: featureQuota.perUse.maxCharacters,
      });
    }
  }

  async #generate(
    transcript: VoiceTranscript,
    request: {
      readonly userId: string;
      readonly timezone: string;
      readonly locale: SupportedLocale;
      readonly signal?: AbortSignal;
    },
  ): Promise<ChargedGeneration<VoiceNoteDigestResult>> {
    const { contextReader, generator } = this.#dependencies;
    const { userId, timezone, locale, signal } = request;
    const context = await contextReader.read(userId, timezone);
    const digest = await generator.digestVoiceNote({
      userId,
      timezone,
      locale,
      transcript: transcript.text,
      sentences: transcript.segments,
      categories: context.categories,
      upcomingTodos: context.upcomingTodos,
      signal,
    });
    return {
      result: {
        title: digest.title,
        summary: digest.summary,
        keyPoints: digest.keyPoints.map((point) => ({
          text: point.text,
          startMs: transcript.startMsAt(point.sentenceIndex),
        })),
        plan: toActionPlanView(digest.plan, context.upcomingTodos),
        model: digest.meta.model,
      },
      outcome: resolveChargeOutcome(digest),
    };
  }
}
