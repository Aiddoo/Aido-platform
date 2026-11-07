import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSuspenseQuery } from '@tanstack/react-query';

import { voiceNoteParamsSchema } from '../schemas/voice-note-params.schema';
import { useVoiceNote } from './use-voice-notes';

export function useCurrentVoiceNote() {
  const [{ draftId }] = useRouteParams(voiceNoteParamsSchema);
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());

  const [note] = useVoiceNote(me.id, draftId);

  return [{ accountId: me.id, draftId, note }] as const;
}
