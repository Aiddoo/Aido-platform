import { type FactoryProvider, Logger, type Provider } from "@nestjs/common";

import { QUOTA_LEDGER, type QuotaLedgerPort } from "#api/modules/access/access-quota.public";
import { UserLocalePreferenceReaderPort } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { ActionPlanGeneratorPort } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import { ChargedPlanRunnerPort } from "../action-plans/application/ports/charged-plan-runner.port.js";
import { VoiceNoteDigestResultReplayPort } from "../action-plans/application/ports/plan-result-replay.port.js";
import { PlanningContextReaderPort } from "../action-plans/application/ports/planning-context.reader.port.js";
import { DigestVoiceNoteUseCase } from "./application/use-cases/digest-voice-note.use-case.js";

// access 사용량 원장은 아직 Symbol 토큰이라 provideUseCase 대신 inject 목록으로 조립한다
const digestVoiceNoteProvider: FactoryProvider<DigestVoiceNoteUseCase> = {
  provide: DigestVoiceNoteUseCase,
  inject: [
    ChargedPlanRunnerPort,
    QUOTA_LEDGER,
    ActionPlanGeneratorPort,
    PlanningContextReaderPort,
    UserLocalePreferenceReaderPort,
    VoiceNoteDigestResultReplayPort,
    ClockPort,
    OperationalAlertPort,
  ],
  useFactory: (
    runner: ChargedPlanRunnerPort,
    quota: QuotaLedgerPort,
    generator: ActionPlanGeneratorPort,
    contextReader: PlanningContextReaderPort,
    localePreferenceReader: UserLocalePreferenceReaderPort,
    replay: VoiceNoteDigestResultReplayPort,
    clock: ClockPort,
    alert: OperationalAlertPort,
  ) =>
    new DigestVoiceNoteUseCase({
      runner,
      quota,
      generator,
      contextReader,
      localePreferenceReader,
      replay,
      clock,
      alert,
      logger: new Logger(DigestVoiceNoteUseCase.name),
    }),
};

export const VOICE_VOICE_NOTES_PROVIDERS = [digestVoiceNoteProvider] satisfies Provider[];
