import { voiceNoteDigestResponseSchema } from "@aido/api/contracts/voice";
import type { FactoryProvider, Provider } from "@nestjs/common";
import { z } from "zod";

import { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";
import { UserLocalePreferenceReaderPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { ActionPlanGeneratorPort } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { ChargedPlanRunnerPort } from "../action-plans/application/ports/charged-plan-runner.port.js";
import { PlanningContextReaderPort } from "../action-plans/application/ports/planning-context.reader.port.js";
import {
  InMemoryPlanResultReplayAdapter,
  PlanResultReplayCache,
} from "../action-plans/infrastructure/adapters/in-memory-plan-result-replay.adapter.js";
import { VoiceNoteDigestResultReplayPort } from "./application/ports/voice-note-digest-result-replay.port.js";
import { DigestVoiceNoteUseCase } from "./application/use-cases/digest-voice-note.use-case.js";

const voiceNoteDigestResultReplayProvider: FactoryProvider<VoiceNoteDigestResultReplayPort> = {
  provide: VoiceNoteDigestResultReplayPort,
  inject: [PlanResultReplayCache],
  useFactory: (cache: PlanResultReplayCache) =>
    new InMemoryPlanResultReplayAdapter(
      cache,
      "voice-note-digest",
      voiceNoteDigestResponseSchema
        .omit({ featureQuota: true, charged: true })
        .extend({ model: z.string() }),
    ),
};

export const VOICE_VOICE_NOTES_PROVIDERS = [
  voiceNoteDigestResultReplayProvider,
  provideUseCase(DigestVoiceNoteUseCase, {
    runner: ChargedPlanRunnerPort,
    quota: QuotaLedgerPort,
    generator: ActionPlanGeneratorPort,
    contextReader: PlanningContextReaderPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    replay: VoiceNoteDigestResultReplayPort,
    clock: ClockPort,
    alert: OperationalAlertPort,
    logger: loggerFor(DigestVoiceNoteUseCase),
  }),
] satisfies Provider[];
