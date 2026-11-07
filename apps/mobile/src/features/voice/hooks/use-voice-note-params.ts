import { useLocalSearchParams } from 'expo-router';

import {
  voiceNoteParamsSchema,
  voiceNoteRecordParamsSchema,
} from '../schemas/voice-note-params.schema';

export function useVoiceNoteRecordParams() {
  return voiceNoteRecordParamsSchema.parse(useLocalSearchParams());
}

export function useVoiceNoteParams() {
  return voiceNoteParamsSchema.parse(useLocalSearchParams());
}
