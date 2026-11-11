import { Module } from "@nestjs/common";

import { AccessQuotasModule } from "#api/modules/access/quotas/access-quotas.public";
import { AiAssistanceGenerationModule } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { AiAssistanceParsingModule } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import { AiAssistancePlanningModule } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";

import { VoiceActionPlansModule } from "../action-plans/voice-action-plans.module.js";
import { VoiceNoteController } from "./presentation/http/v1/voice-note.controller.js";
import { VOICE_VOICE_NOTES_PROVIDERS } from "./voice-voice-notes.providers.js";

/** 녹음 정리. 기기가 전사한 글자만 받고 녹음도 전사도 저장하지 않는다. */
@Module({
  imports: [
    AccessQuotasModule,
    AiAssistanceGenerationModule,
    AiAssistanceParsingModule,
    AiAssistancePlanningModule,
    IdentitySettingsModule,
    VoiceActionPlansModule,
  ],
  controllers: [VoiceNoteController],
  providers: [...VOICE_VOICE_NOTES_PROVIDERS],
})
export class VoiceVoiceNotesModule {}
