export const VOICE_NOTE_LOG_EVENT = {
  DRAFT_RESTORE_FAILED: 'voice.draft.restore-failed',
  DRAFT_SAVE_FAILED: 'voice.draft.save-failed',
  RECORDING_SAVE_FAILED: 'voice.recording.save-failed',
  RECORDING_REMOVE_FAILED: 'voice.recording.remove-failed',
  RECORDING_CLEANUP_FAILED: 'voice.recording.cleanup-failed',
  PLAYER_AUDIO_MODE_FAILED: 'voice.player.audio-mode-failed',
  PLAYER_SEEK_FAILED: 'voice.player.seek-failed',
  RECORD_ACTION_FAILED: 'voice.record.action-failed',
  RECORD_LANGUAGE_CHANGE_FAILED: 'voice.record.language-change-failed',
} as const;
