import { useVoiceNoteStorageService } from '@src/bootstrap/providers/di-context';
import { orderBy } from 'es-toolkit';
import { useSyncExternalStore } from 'react';

import { VoiceNotePolicy } from '../domains/voice-note.model';

function useStoredVoiceNotes(accountId: string) {
  const { drafts } = useVoiceNoteStorageService();
  return useSyncExternalStore(drafts.subscribe, () => drafts.getSnapshot(accountId));
}

/** 기기에 남은 내 말로 메모. 글자가 없는 초안(시작하고 바로 꺼진 경우)은 보이지 않는다 */
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
