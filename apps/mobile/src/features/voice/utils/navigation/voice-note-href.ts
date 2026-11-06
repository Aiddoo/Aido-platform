import type { VoiceCaptureEntry } from '@src/shared/observability/telemetry-keys';

interface VoiceNoteRecordHrefOptions {
  draftId?: string;
  entry?: Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;
}

export function voiceNoteRecordHref({ draftId, entry }: VoiceNoteRecordHrefOptions = {}) {
  return {
    pathname: '/voice-notes/record',
    params: { ...(draftId != null && { draftId }), ...(entry != null && { entry }) },
  } as const;
}

export function voiceNoteListHref() {
  return '/voice-notes' as const;
}

export function voiceNoteHref(draftId: string) {
  return { pathname: '/voice-notes/[draftId]', params: { draftId } } as const;
}
