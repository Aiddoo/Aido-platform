import { useGetMeQueryOptions } from '@src/features/identity/user/queries/get-me-query-options';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useVoiceNoteParams } from './use-voice-note-params';
import { useVoiceNote } from './use-voice-notes';

export function useCurrentVoiceNote() {
  const { draftId } = useVoiceNoteParams();
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());

  return { accountId: me.id, draftId, note: useVoiceNote(me.id, draftId) };
}
