export const VOICE_NOTE_RECORD_HREF = '/voice-notes/record';

export function voiceNoteHref(draftId: string) {
  return { pathname: '/voice-notes/[draftId]', params: { draftId } } as const;
}
