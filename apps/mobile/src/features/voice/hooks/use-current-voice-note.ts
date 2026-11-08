import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSuspenseQuery } from '@tanstack/react-query';

import { voiceNoteParamsSchema } from '../schemas/voice-note-params.schema';
import { useVoiceNote } from './use-voice-notes';

/**
 * 지금 화면의 말로 메모 초안 위치(계정·초안 id). 초안 저장소를 구독하지 않아 녹음·정리로 초안이 바뀌어도
 * id만 쓰는 컴포넌트는 다시 그려지지 않는다
 */
export function useVoiceNoteRoute() {
  const [{ draftId }] = useRouteParams(voiceNoteParamsSchema);
  const { data: me } = useSuspenseQuery(useGetMeQueryOptions());

  return [{ accountId: me.id, draftId }] as const;
}

/** 지금 화면의 말로 메모 초안과 그 내용. 내용이 바뀔 때마다 다시 그려진다 */
export function useCurrentVoiceNote() {
  const [{ accountId, draftId }] = useVoiceNoteRoute();
  const [note] = useVoiceNote(accountId, draftId);

  return [{ accountId, draftId, note }] as const;
}
