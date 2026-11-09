import { useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { useSyncExternalStore } from 'react';

import { VoiceNotePolicy } from '../domains/voice-note.model';

function useStoredVoiceNotes(accountId: string) {
  const drafts = useVoiceNoteDraftRepository();
  return useSyncExternalStore(drafts.subscribe, () => drafts.getSnapshot(accountId));
}

export function useVoiceNotes(accountId: string) {
  const notes = useStoredVoiceNotes(accountId);
  return [VoiceNotePolicy.getListedNotes(notes)] as const;
}

export function useVoiceNote(accountId: string, draftId: string) {
  const notes = useStoredVoiceNotes(accountId);
  return [notes.find((note) => note.draftId === draftId) ?? null] as const;
}
