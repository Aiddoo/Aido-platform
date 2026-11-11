import { voiceNoteDigestRequestSchema, voiceNoteDigestResponseSchema } from "@aido/api";
import type { z } from "zod";

export const VoiceNoteDigestRequestDto = voiceNoteDigestRequestSchema.meta({
  id: "VoiceNoteDigestRequestDto",
});
export type VoiceNoteDigestRequestDto = z.infer<typeof VoiceNoteDigestRequestDto>;
export const VoiceNoteDigestResponseDto = voiceNoteDigestResponseSchema.meta({
  id: "VoiceNoteDigestResponseDto",
});
export type VoiceNoteDigestResponseDto = z.infer<typeof VoiceNoteDigestResponseDto>;
