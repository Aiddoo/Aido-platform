import { voiceNoteDigestResponseSchema } from "@aido/api/contracts/voice";
import type { FactoryProvider, Provider } from "@nestjs/common";
import { z } from "zod";

import { QuotaLedgerPort } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { UserLocalePreferenceReaderPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { ActionPlanGeneratorPort } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import {
  ChargedPlanRunnerPort,
  PlanningContextReaderPort,
  PlanResultReplayFactoryPort,
} from "#api/modules/voice/plan-applications/voice-plan-applications.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { VoiceDigestResultReplayPort } from "./application/ports/voice-digest-result-replay.port.js";
import { DigestVoiceNoteUseCase } from "./application/use-cases/digest-voice-note.use-case.js";

const voiceDigestResultReplayProvider: FactoryProvider<VoiceDigestResultReplayPort> = {
  provide: VoiceDigestResultReplayPort,
  inject: [PlanResultReplayFactoryPort],
  useFactory: (replayFactory: PlanResultReplayFactoryPort) =>
    replayFactory.forNamespace(
      "voice-note-digest",
      voiceNoteDigestResponseSchema
        .omit({ featureQuota: true, charged: true })
        .extend({ model: z.string() }),
    ),
};

export const VOICE_VOICE_DIGESTS_PROVIDERS = [
  voiceDigestResultReplayProvider,
  provideUseCase(DigestVoiceNoteUseCase, {
    runner: ChargedPlanRunnerPort,
    quota: QuotaLedgerPort,
    generator: ActionPlanGeneratorPort,
    contextReader: PlanningContextReaderPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    replay: VoiceDigestResultReplayPort,
    clock: ClockPort,
    alert: OperationalAlertPort,
    logger: loggerFor(DigestVoiceNoteUseCase),
  }),
] satisfies Provider[];
