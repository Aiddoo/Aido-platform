import type { VoiceNoteDigestResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import {
  resolveRequestLocale,
  type UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import type {
  ActionPlanGeneratorPort,
  VoiceNoteDigestGeneration,
} from "#api/modules/ai-assistance/ai-assistance-planning.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  type TranscriptSegment,
  VoiceTranscript,
} from "../../../domain/value-objects/notes/voice-transcript.vo.js";
import { VoiceLogEvent } from "../../observability/plans/voice-log.events.js";
import type { PlanResultReplayPort } from "../../ports/plans/plan-result-replay.port.js";
import type { PlanningContextReaderPort } from "../../ports/plans/planning-context.reader.port.js";
import {
  countPlannedActions,
  toActionPlanMeta,
  toActionPlanView,
} from "../../read-models/plans/action-plan.read-model.js";
import type {
  ChargedPlanRunner,
  GeneratedPlan,
  PlanChargeOutcome,
} from "../../services/plans/charged-plan-runner.js";
import { fingerprintRequest } from "../../services/plans/request-fingerprint.js";

export type VoiceNoteDigestResult = Omit<VoiceNoteDigestResponse, "featureQuota" | "charged">;

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
}

interface DigestVoiceNoteDependencies {
  readonly runner: Pick<ChargedPlanRunner, "run">;
  readonly quota: Pick<QuotaLedgerPort, "read">;
  readonly generator: Pick<ActionPlanGeneratorPort, "digestVoiceNote">;
  readonly contextReader: Pick<PlanningContextReaderPort, "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly replay: PlanResultReplayPort<VoiceNoteDigestResult>;
  readonly logger: Pick<ApplicationLogger, "log" | "warn">;
}

/** 요약·핵심 내용도 결과이므로 할 일이 0개여도 횟수를 쓴다. 돌려줄 내용이 전혀 없을 때만 환불한다. */
function resolveChargeOutcome(digest: VoiceNoteDigestGeneration): PlanChargeOutcome {
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
          generate: () => this.#generate(transcript, { userId, timezone, locale, startedAt }),
        });
      this.#dependencies.logger.log({
        event: VoiceLogEvent.NOTE_DIGEST_COMPLETED,
        ...logFields,
        ...countPlannedActions(result.plan),
        keyPointCount: result.keyPoints.length,
        model: result.meta.model,
        latencyMs: Date.now() - startedAt,
        quotaCharged: charged,
      });
      return { ...result, featureQuota, charged };
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
      readonly startedAt: number;
    },
  ): Promise<GeneratedPlan<VoiceNoteDigestResult>> {
    const { contextReader, generator } = this.#dependencies;
    const { userId, timezone, locale, startedAt } = request;
    const context = await contextReader.read(userId, timezone);
    const digest = await generator.digestVoiceNote({
      userId,
      timezone,
      locale,
      transcript: transcript.text,
      sentences: transcript.segments,
      categories: context.categories,
      upcomingTodos: context.upcomingTodos,
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
        meta: toActionPlanMeta(digest.meta, Date.now() - startedAt),
      },
      outcome: resolveChargeOutcome(digest),
    };
  }
}
