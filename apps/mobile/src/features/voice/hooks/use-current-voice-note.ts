import { useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { useSyncExternalStore } from 'react';

import type { VoiceNote } from '../domains/voice-note.model';
import { useVoiceNoteDraftId } from './use-voice-note-params';

/**
 * 지금 화면의 초안. 화면이 초안이 있는 단계에서만 그리는 조각이 부르고, 내용이 바뀔 때마다 다시 그려진다.
 * 지우면 화면이 먼저 'missing'으로 바꿔 이 조각을 내리므로 없는 초안을 읽지 않는다
 */
export function useCurrentVoiceNote(accountId: string): VoiceNote {
  const [draftId] = useVoiceNoteDraftId();
  const drafts = useVoiceNoteDraftRepository();
  const note = useSyncExternalStore(
    drafts.subscribe,
    () => drafts.getSnapshot(accountId).find((draft) => draft.draftId === draftId) ?? null,
  );
  if (note == null) {
    throw new Error('[useCurrentVoiceNote] 초안이 없는 단계에서 그렸다');
  }

  return note;
}
