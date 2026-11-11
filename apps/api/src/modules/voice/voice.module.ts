import { Module } from "@nestjs/common";

import { VoiceActionPlansModule } from "./action-plans/voice-action-plans.module.js";
import { VoiceVoiceNotesModule } from "./voice-notes/voice-voice-notes.module.js";

@Module({
  imports: [VoiceActionPlansModule, VoiceVoiceNotesModule],
})
export class VoiceModule {}
