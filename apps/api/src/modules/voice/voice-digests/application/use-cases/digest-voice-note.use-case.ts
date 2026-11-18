import type { SupportedLocale } from "@aido/api/vocabulary";
import { omit } from "es-toolkit";

import type {
  MeteredFeatureQuotaReadModel,
  QuotaLedgerPort,
} from "#api/modules/access/quota-charges/access-quota-charges.public";
import type {
  ActionPlanGeneratorPort,
  VoiceNoteDigestGeneration,
} from "#api/modules/ai-assistance/action-plan-drafts/ai-assistance-action-plan-drafts.public";
import {
  fingerprintRequest,
  resolveRequestLocale,
  type UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/ai-generations/ai-assistance-ai-generations.public";
import type {
  ChargedGeneration,
  ChargeOutcome,
} from "#api/modules/ai-assistance/parsed-drafts/ai-assistance-parsed-drafts.public";
import {
  type ChargedPlanRunnerPort,
  countPlannedActions,
  type PlanningContextReaderPort,
  type PlanResultReplay,
  toActionPlanReadModel,
} from "#api/modules/voice/plan-applications/voice-plan-applications.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { VoiceDigest } from "../../domain/voice-digest.aggregate.js";
import { VOICE_NOTE_DURATION_TOLERANCE_SECONDS } from "../../domain/voice-digests.constants.js";
import { type TranscriptSegment, VoiceTranscript } from "../../domain/voice-transcript.vo.js";
import type { VoiceDigestResult } from "../ports/voice-digest-result-replay.port.js";
import type { VoiceDigestReadModel } from "../read-models/voice-digest.read-model.js";
import { VoiceDigestAlerts } from "../voice-digests.alerts.js";
import { voiceNoteTooLong } from "../voice-digests.errors.js";
import { VoiceDigestLogEvent } from "../voice-digests.log-events.js";

export interface DigestVoiceNoteCommand {
  readonly userId: string;
  readonly text: string;
  readonly durationSeconds: number;
  readonly segments: readonly TranscriptSegment[];
  readonly idempotencyKey: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  readonly timezone: string | undefined;
  /** Accept-Language 헤더가 고른 언어. null이면 저장된 사용자 언어를 쓴다(resolveRequestLocale). */
  readonly requestedLocale: SupportedLocale | null;
  /** 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다. */
  readonly signal?: AbortSignal;
}

export interface DigestedVoiceNote extends VoiceDigestReadModel {
  /** 이 요청을 반영한 VOICE_NOTE 한도. 결과는 주되 한도를 읽지 못했으면 null이다 */
  readonly featureQuota: MeteredFeatureQuotaReadModel | null;
  readonly charged: boolean;
}

interface DigestVoiceNoteDependencies {
  readonly runner: Pick<ChargedPlanRunnerPort, "run">;
  readonly quota: Pick<QuotaLedgerPort, "read">;
  readonly generator: Pick<ActionPlanGeneratorPort, "digestVoiceNote">;
  readonly contextReader: Pick<PlanningContextReaderPort, "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly replay: PlanResultReplay<VoiceDigestResult>;
  readonly clock: ClockPort;
  readonly alert: Pick<OperationalAlertPort, "raise">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 요약·핵심 내용도 결과이므로 할 일이 0개여도 횟수를 쓴다. 돌려줄 내용이 전혀 없을 때만 환불한다. */
function resolveChargeOutcome(digest: VoiceNoteDigestGeneration): ChargeOutcome {
  return digest.isEmpty ? "EMPTY" : "CHARGE";
}

/** 긴 전사 → 제목·요약·핵심 내용·실행 계획. 전사 글자는 요청이 끝나면 어디에도 남지 않는다. */
export class DigestVoiceNoteUseCase {
  readonly #dependencies: DigestVoiceNoteDependencies;

  constructor(dependencies: DigestVoiceNoteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DigestVoiceNoteCommand): Promise<DigestedVoiceNote> {
    const { userId, text, durationSeconds, segments, idempotencyKey } = input;
    const owner = UserId.reconstitute(userId);
    const startedAt = this.#dependencies.clock.now().epochMilliseconds;
    const transcript = VoiceTranscript.create({ text, durationSeconds, segments });
    const logFields = {
      userId,
      characterCount: transcript.characterCount,
      segmentCount: segments.length,
      durationSeconds,
    };
    try {
      await this.#assertWithinPerUseLimit(owner, transcript);

      const { timezone, locale } = await resolveRequestLocale(
        this.#dependencies.localePreferenceReader,
        owner,
        input,
      );
      const { result, charged, featureQuota } =
        await this.#dependencies.runner.run<VoiceDigestResult>({
          userId: owner,
          feature: "VOICE_NOTE",
          reason: "voice-note-digest",
          idempotencyKey,
          requestHash: fingerprintRequest(userId, { text, durationSeconds, segments }),
          replay: this.#dependencies.replay,
          generate: () =>
            this.#generate(transcript, {
              userId: owner,
              timezone,
              locale,
              signal: input.signal,
            }),
        });
      this.#dependencies.logger.log({
        event: VoiceDigestLogEvent.DIGEST_COMPLETED,
        ...logFields,
        ...countPlannedActions(result.plan),
        keyPointCount: result.keyPoints.length,
        model: result.model,
        latencyMs: this.#dependencies.clock.now().epochMilliseconds - startedAt,
        quotaCharged: charged,
      });
      return { ...omit(result, ["model"]), featureQuota, charged };
    } catch (error) {
      this.#dependencies.logger.warn({
        event: VoiceDigestLogEvent.DIGEST_FAILED,
        ...logFields,
        latencyMs: this.#dependencies.clock.now().epochMilliseconds - startedAt,
        ...(error instanceof ErrorCodedException
          ? { errorCode: error.errorCode }
          : { errorType: toErrorType(error) }),
      });
      throw error;
    }
  }

  /** 등급별 상한은 access가 계산해 준 값만 쓴다. 차감 전에 막아 횟수를 쓰지 않는다. */
  async #assertWithinPerUseLimit(owner: UserId, transcript: VoiceTranscript): Promise<void> {
    const featureQuota = await this.#dependencies.quota.read(owner, "VOICE_NOTE");
    if (
      featureQuota.perUse != null &&
      transcript.exceedsDuration({
        maxSeconds: featureQuota.perUse.maxSeconds,
        toleranceSeconds: VOICE_NOTE_DURATION_TOLERANCE_SECONDS,
      })
    ) {
      // 1.15.1은 출시 앱 호환을 위해 거절하지 않고 경보만 올린다(1.15.2부터 거절)
      this.#dependencies.alert.raise({
        ...VoiceDigestAlerts.DURATION_OVER_LIMIT,
        details: {
          durationSeconds: transcript.durationSeconds,
          maxSeconds: featureQuota.perUse.maxSeconds,
        },
      });
    }
    if (featureQuota.perUse != null && transcript.exceeds(featureQuota.perUse)) {
      throw voiceNoteTooLong(
        featureQuota,
        transcript.characterCount,
        featureQuota.perUse.maxCharacters,
      );
    }
  }

  async #generate(
    transcript: VoiceTranscript,
    request: {
      readonly userId: UserId;
      readonly timezone: string;
      readonly locale: SupportedLocale;
      readonly signal?: AbortSignal;
    },
  ): Promise<ChargedGeneration<VoiceDigestResult>> {
    const { contextReader, generator } = this.#dependencies;
    const { userId, timezone, locale, signal } = request;
    const context = await contextReader.read(userId, timezone);
    const generation = await generator.digestVoiceNote({
      userId,
      timezone,
      locale,
      transcript: transcript.text,
      sentences: transcript.segments,
      categories: context.categories,
      upcomingTodos: context.upcomingTodos,
      signal,
    });
    const { title, summary, keyPoints } = VoiceDigest.create({
      transcript,
      title: generation.title,
      summary: generation.summary,
      keyPoints: generation.keyPoints,
    }).toPrimitives();
    return {
      result: {
        title,
        summary,
        keyPoints,
        plan: toActionPlanReadModel(generation.plan, context.upcomingTodos),
        model: generation.meta.model,
      },
      outcome: resolveChargeOutcome(generation),
    };
  }
}
