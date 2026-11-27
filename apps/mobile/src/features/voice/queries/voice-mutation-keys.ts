export const VOICE_MUTATION_KEYS = {
  all: ['voice', 'mutation'] as const,
  applyActionPlan: () => [...VOICE_MUTATION_KEYS.all, 'apply-action-plan'] as const,
  createQuickPlan: () => [...VOICE_MUTATION_KEYS.all, 'create-quick-plan'] as const,
  createVoiceNoteDigest: () => [...VOICE_MUTATION_KEYS.all, 'create-voice-note-digest'] as const,
} as const;
