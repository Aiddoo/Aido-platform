import { Module } from "@nestjs/common";

import { VoicePlanApplicationsModule } from "./plan-applications/voice-plan-applications.module.js";
import { VoiceVoiceDigestsModule } from "./voice-digests/voice-voice-digests.module.js";

@Module({
  imports: [VoicePlanApplicationsModule, VoiceVoiceDigestsModule],
})
export class VoiceModule {}
