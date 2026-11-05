import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useVoiceNoteParams } from './use-voice-note-params';
import { useVoiceNote } from './use-voice-notes';

/** 말로 메모 결과 화면이 보고 있는 노트. 이 계정 기기에 없으면 `note`가 없다 */
export function useCurrentVoiceNote() {
  const { draftId } = useVoiceNoteParams();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());

  return { accountId: me.id, draftId, note: useVoiceNote(me.id, draftId) };
}
