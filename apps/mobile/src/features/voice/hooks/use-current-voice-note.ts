import { useVoiceNoteDraftRepository } from '@src/bootstrap/providers/di-context';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSyncExternalStore } from 'react';

import { VoiceNotePolicy, type VoiceNote } from '../domains/voice-note.model';
import { voiceNoteParamsSchema } from '../schemas/voice-note-params.schema';

type VoiceNoteStage = 'missing' | 'recorded' | 'digested';

/** 초안 저장소를 구독하지 않아 녹음·정리로 초안이 바뀌어도 id만 쓰는 컴포넌트는 다시 그려지지 않는다 */
export function useVoiceNoteRoute() {
  const [{ draftId }] = useRouteParams(voiceNoteParamsSchema);
  const accountId = useSuspenseMyAccountId();

  return [{ accountId, draftId }] as const;
}

/** 지금 화면이 그릴 단계. 자동 저장으로 내용이 바뀌어도 단계가 같으면 다시 그려지지 않는다 */
export function useCurrentVoiceNoteStage(): VoiceNoteStage {
  const [{ accountId, draftId }] = useVoiceNoteRoute();
  const drafts = useVoiceNoteDraftRepository();

  return useSyncExternalStore(drafts.subscribe, () => {
    const note = findNote(drafts.getSnapshot(accountId), draftId);
    if (note == null) {
      return 'missing';
    }
    return VoiceNotePolicy.isDigested(note) ? 'digested' : 'recorded';
  });
}

/**
 * 지금 화면의 초안. 화면이 초안이 있는 단계에서만 그리는 조각이 부르고, 내용이 바뀔 때마다 다시 그려진다.
 * 지우면 화면이 먼저 'missing'으로 바꿔 이 조각을 내리므로 없는 초안을 읽지 않는다
 */
export function useCurrentVoiceNote(): VoiceNote {
  const [{ accountId, draftId }] = useVoiceNoteRoute();
  const drafts = useVoiceNoteDraftRepository();
  const note = useSyncExternalStore(drafts.subscribe, () =>
    findNote(drafts.getSnapshot(accountId), draftId),
  );
  if (note == null) {
    throw new Error('[useCurrentVoiceNote] 초안이 없는 단계에서 그렸다');
  }

  return note;
}

function findNote(notes: readonly VoiceNote[], draftId: string) {
  return notes.find((note) => note.draftId === draftId) ?? null;
}
