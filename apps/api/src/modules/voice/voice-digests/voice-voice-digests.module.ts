import { Module } from "@nestjs/common";

import { AccessQuotaChargesModule } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { AiAssistanceGenerationModule } from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import { AiAssistanceParsingModule } from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import { AiAssistancePlanningModule } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { VoicePlanApplicationsModule } from "#api/modules/voice/plan-applications/voice-plan-applications.public";

import { VoiceNoteController } from "./presentation/http/v1/voice-note.controller.js";
import { VOICE_VOICE_DIGESTS_PROVIDERS } from "./voice-voice-digests.providers.js";

/** 녹음 정리. 기기가 전사한 글자만 받고 녹음도 전사도 저장하지 않는다. */
@Module({
  imports: [
    AccessQuotaChargesModule,
    AiAssistanceGenerationModule,
    AiAssistanceParsingModule,
    AiAssistancePlanningModule,
    IdentitySettingsModule,
    VoicePlanApplicationsModule,
  ],
  controllers: [VoiceNoteController],
  providers: [...VOICE_VOICE_DIGESTS_PROVIDERS],
})
export class VoiceVoiceDigestsModule {}
