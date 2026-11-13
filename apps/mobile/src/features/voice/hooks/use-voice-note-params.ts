import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import {
  voiceNoteParamsSchema,
  voiceNoteStartParamsSchema,
} from '../schemas/voice-note-params.schema';

/** `/voice-notes/[draftId]`의 초안. 화면의 정체성이라 바꾸지 않는다. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useVoiceNoteDraftId() {
  const [{ draftId }] = useRouteParams(voiceNoteParamsSchema);

  return [draftId] as const;
}

/** 다른 화면이 메모 탭에 남긴 말로 메모하기 시작 요청. 받은 쪽이 한 번 시작하고 지운다 */
export function useStartVoiceNoteRequest() {
  const [{ startVoiceNote }, setParams] = useRouteParams(voiceNoteStartParamsSchema);
  const clearStartVoiceNote = useCallback(
    () => setParams({ startVoiceNote: undefined }),
    [setParams],
  );

  return [startVoiceNote != null, clearStartVoiceNote] as const;
}
