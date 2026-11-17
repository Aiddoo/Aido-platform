import { Module } from "@nestjs/common";

import { AccessQuotaChargesModule } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { AiAssistanceActionPlanDraftsModule } from "#api/modules/ai-assistance/action-plan-drafts/ai-assistance-action-plan-drafts.public";
import { AiAssistanceAiGenerationsModule } from "#api/modules/ai-assistance/ai-generations/ai-assistance-ai-generations.public";
import { AiAssistanceParsedDraftsModule } from "#api/modules/ai-assistance/parsed-drafts/ai-assistance-parsed-drafts.public";
import { IdentityUserPreferencesModule } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { VoicePlanApplicationsModule } from "#api/modules/voice/plan-applications/voice-plan-applications.public";

import { VoiceNoteController } from "./presentation/http/v1/voice-note.controller.js";
import { VOICE_VOICE_DIGESTS_PROVIDERS } from "./voice-voice-digests.providers.js";

/** 녹음 정리. 기기가 전사한 글자만 받고 녹음도 전사도 저장하지 않는다. */
@Module({
  imports: [
    AccessQuotaChargesModule,
    AiAssistanceAiGenerationsModule,
    AiAssistanceParsedDraftsModule,
    AiAssistanceActionPlanDraftsModule,
    IdentityUserPreferencesModule,
    VoicePlanApplicationsModule,
  ],
  controllers: [VoiceNoteController],
  providers: [...VOICE_VOICE_DIGESTS_PROVIDERS],
})
export class VoiceVoiceDigestsModule {}
