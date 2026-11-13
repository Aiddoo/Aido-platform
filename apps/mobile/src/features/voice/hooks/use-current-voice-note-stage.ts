import { useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { useSyncExternalStore } from 'react';

import { VoiceNotePolicy } from '../domains/voice-note.model';
import { useVoiceNoteDraftId } from './use-voice-note-params';

type VoiceNoteStage = 'missing' | 'recorded' | 'digested';

/** 지금 화면이 그릴 단계. 자동 저장으로 내용이 바뀌어도 단계가 같으면 다시 그려지지 않는다 */
export function useCurrentVoiceNoteStage(accountId: string): VoiceNoteStage {
  const [draftId] = useVoiceNoteDraftId();
  const drafts = useVoiceNoteDraftRepository();

  return useSyncExternalStore(drafts.subscribe, () => {
    const note = drafts.getSnapshot(accountId).find((draft) => draft.draftId === draftId);
    if (note == null) {
      return 'missing';
    }
    return VoiceNotePolicy.isDigested(note) ? 'digested' : 'recorded';
  });
}
