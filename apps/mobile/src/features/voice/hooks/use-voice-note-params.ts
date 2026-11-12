import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { voiceNoteParamsSchema } from '../schemas/voice-note-params.schema';

/** `/voice-notes/[draftId]`의 초안. 화면의 정체성이라 바꾸지 않는다. 잘못된 값은 route가 먼저 돌려보낸다 */
export function useVoiceNoteDraftId() {
  const [{ draftId }] = useRouteParams(voiceNoteParamsSchema);

  return [draftId] as const;
}
