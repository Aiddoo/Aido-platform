import { useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { useSyncExternalStore } from 'react';

import { VoiceNotePolicy } from '../domains/voice-note.model';

export function useVoiceNotes(accountId: string) {
  const drafts = useVoiceNoteDraftRepository();
  const notes = useSyncExternalStore(drafts.subscribe, () => drafts.getSnapshot(accountId));

  return [VoiceNotePolicy.getListedNotes(notes)] as const;
}
