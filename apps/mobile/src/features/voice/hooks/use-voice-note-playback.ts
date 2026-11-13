import { useSyncExternalStore } from 'react';

import type { VoiceNotePlayback } from '../utils/voice-note-playback.view-model';
import type { VoiceNotePlayer } from './use-voice-note-player';

/** 재생 상태에서 고른 값만 구독한다. 고른 값이 같으면 위치가 바뀌어도 다시 그리지 않는다 */
export function useVoiceNotePlayback<TSelected>(
  player: VoiceNotePlayer,
  select: (playback: VoiceNotePlayback) => TSelected,
): TSelected {
  return useSyncExternalStore(player.subscribe, () => select(player.getPlayback()));
}
