import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { orderBy } from 'es-toolkit';
import { useSyncExternalStore } from 'react';

import { VoiceNotePolicy } from '../domains/voice-note.model';

function useStoredVoiceNotes(accountId: string) {
  const { drafts } = useVoiceNoteStorageService();
  return useSyncExternalStore(drafts.subscribe, () => drafts.getSnapshot(accountId));
}

export function useVoiceNotes(accountId: string) {
  const notes = useStoredVoiceNotes(accountId);
  return orderBy(
    notes.filter(VoiceNotePolicy.hasText),
    [(note) => note.createdAt.getTime()],
    ['desc'],
  );
}

export function useVoiceNote(accountId: string, draftId: string) {
  const notes = useStoredVoiceNotes(accountId);
  return notes.find((note) => note.draftId === draftId);
}
